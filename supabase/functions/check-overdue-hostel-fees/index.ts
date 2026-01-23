import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for overdue hostel fees...');

    const today = new Date().toISOString().split('T')[0];

    // Fetch all overdue hostel fees (unpaid or partially paid, past due date)
    const { data: overdueFees, error: feesError } = await supabase
      .from('hostel_fees')
      .select('*, trainees(trainee_id, first_name, last_name)')
      .lt('due_date', today)
      .in('payment_status', ['pending', 'partial'])
      .order('due_date', { ascending: true });

    if (feesError) {
      console.error('Error fetching overdue fees:', feesError);
      throw feesError;
    }

    console.log(`Found ${overdueFees?.length || 0} overdue fee records`);

    if (!overdueFees || overdueFees.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No overdue fees found',
          overdue_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Group overdue fees by organization
    const feesByOrg = overdueFees.reduce((acc, fee) => {
      if (!acc[fee.organization_id]) {
        acc[fee.organization_id] = [];
      }
      acc[fee.organization_id].push(fee);
      return acc;
    }, {} as Record<string, typeof overdueFees>);

    console.log(`Processing overdue fees for ${Object.keys(feesByOrg).length} organizations`);

    // Send notifications for each organization
    const notificationPromises = Object.entries(feesByOrg).map(async ([orgId, fees]) => {
      const feesArray = fees as any[];
      const totalOverdueAmount = feesArray.reduce((sum: number, fee: any) => sum + (fee.balance || 0), 0);
      
      // Calculate days overdue for each fee
      const feesWithDays = feesArray.map((fee: any) => {
        const dueDate = new Date(fee.due_date);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          trainee_id: fee.trainee_id,
          fee_amount: fee.fee_amount,
          balance: fee.balance,
          due_date: fee.due_date,
          days_overdue: daysOverdue
        };
      });

      try {
        const { data, error } = await supabase.functions.invoke('send-hostel-notification', {
          body: {
            type: 'fees_overdue',
            organization_id: orgId,
            data: {
              overdue_count: feesArray.length,
              overdue_amount: totalOverdueAmount,
              overdue_fees: feesWithDays.slice(0, 20) // Limit to first 20 for email
            }
          }
        });

        if (error) {
          console.error(`Error sending notification for org ${orgId}:`, error);
          return { success: false, orgId, error: error.message };
        }

        console.log(`Notification sent for organization ${orgId}`);
        return { success: true, orgId, count: feesArray.length };
      } catch (error) {
        console.error(`Failed to send notification for org ${orgId}:`, error);
        return { success: false, orgId, error };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`Overdue fee check complete. Notifications sent: ${successful}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${overdueFees.length} overdue fees across ${Object.keys(feesByOrg).length} organizations`,
        overdue_count: overdueFees.length,
        organizations_notified: successful,
        notification_failures: failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in check-overdue-hostel-fees function:', error);
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
