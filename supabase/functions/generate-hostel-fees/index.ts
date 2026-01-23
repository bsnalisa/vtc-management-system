import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HostelAllocation {
  id: string;
  organization_id: string;
  trainee_id: string;
  monthly_fee: number;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting monthly hostel fee generation...');

    // Get current date and calculate fee month (first day of current month)
    const now = new Date();
    const feeMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const feeMonthStr = feeMonth.toISOString().split('T')[0];
    
    // Due date: 5th of the current month
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 5);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    console.log(`Generating fees for month: ${feeMonthStr}, due date: ${dueDateStr}`);

    // Fetch all active hostel allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from('hostel_allocations')
      .select('id, organization_id, trainee_id, monthly_fee, status, allocation_id')
      .eq('status', 'active');

    if (allocationsError) {
      console.error('Error fetching allocations:', allocationsError);
      throw allocationsError;
    }

    console.log(`Found ${allocations?.length || 0} active allocations`);

    if (!allocations || allocations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active allocations found',
          generated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check which allocations already have fees for this month
    const { data: existingFees, error: existingFeesError } = await supabase
      .from('hostel_fees')
      .select('allocation_id, trainee_id')
      .eq('fee_month', feeMonthStr);

    if (existingFeesError) {
      console.error('Error fetching existing fees:', existingFeesError);
      throw existingFeesError;
    }

    // Create a set of allocation IDs that already have fees
    const existingAllocationIds = new Set(
      (existingFees || [])
        .filter(f => f.allocation_id)
        .map(f => f.allocation_id)
    );
    
    // Also track by trainee_id as fallback
    const existingTraineeIds = new Set(
      (existingFees || []).map(f => f.trainee_id)
    );

    console.log(`Found ${existingAllocationIds.size} existing fee records for this month`);

    // Filter allocations that don't have fees yet
    const allocationsNeedingFees = allocations.filter(
      allocation => 
        !existingAllocationIds.has(allocation.id) && 
        !existingTraineeIds.has(allocation.trainee_id)
    );

    console.log(`${allocationsNeedingFees.length} allocations need new fee records`);

    if (allocationsNeedingFees.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All allocations already have fees for this month',
          generated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Prepare fee records to insert
    const feeRecords = allocationsNeedingFees.map(allocation => ({
      organization_id: allocation.organization_id,
      trainee_id: allocation.trainee_id,
      allocation_id: allocation.id,
      fee_month: feeMonthStr,
      fee_amount: allocation.monthly_fee,
      amount_paid: 0,
      balance: allocation.monthly_fee,
      due_date: dueDateStr,
      payment_status: 'pending',
      notes: `Auto-generated fee for ${feeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    }));

    // Insert fee records in batches to avoid timeout
    const batchSize = 100;
    let totalInserted = 0;
    const errors: any[] = [];

    for (let i = 0; i < feeRecords.length; i += batchSize) {
      const batch = feeRecords.slice(i, i + batchSize);
      
      const { data: insertedFees, error: insertError } = await supabase
        .from('hostel_fees')
        .insert(batch)
        .select();

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        errors.push({
          batch: i / batchSize + 1,
          error: insertError.message
        });
      } else {
        totalInserted += insertedFees?.length || 0;
        console.log(`Inserted batch ${i / batchSize + 1}: ${insertedFees?.length || 0} records`);
      }
    }

    console.log(`Fee generation complete. Total inserted: ${totalInserted}`);

    // Send notifications for generated fees
    if (totalInserted > 0) {
      try {
        const organizations = new Set(allocationsNeedingFees.map(a => a.organization_id));
        
        for (const orgId of organizations) {
          const orgAllocations = allocationsNeedingFees.filter(a => a.organization_id === orgId);
          const totalAmount = orgAllocations.reduce((sum, a) => sum + a.monthly_fee, 0);
          
          // Create in-app notification for hostel coordinators
          await supabase.functions.invoke('create-notification', {
            body: {
              organization_id: orgId,
              role: 'hostel_coordinator',
              type: 'fee_generated',
              priority: 'medium',
              title: 'Monthly Hostel Fees Generated',
              message: `${orgAllocations.length} hostel fee records for ${feeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} have been generated. Total amount: R ${totalAmount.toFixed(2)}`,
              metadata: {
                month: feeMonthStr,
                count: orgAllocations.length,
                total_amount: totalAmount
              },
              action_url: '/hostel-management',
            }
          });

          // Send email notification
          await supabase.functions.invoke('send-hostel-notification', {
            body: {
              type: 'fees_generated',
              organization_id: orgId,
              data: {
                month: feeMonthStr,
                total_fees: orgAllocations.length,
                total_amount: totalAmount
              }
            }
          });
        }
        
        console.log('Notifications sent to coordinators');
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully generated ${totalInserted} hostel fee records`,
        generated: totalInserted,
        month: feeMonthStr,
        due_date: dueDateStr,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in generate-hostel-fees function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
