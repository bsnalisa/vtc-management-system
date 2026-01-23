import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'fees_generated' | 'fees_overdue';
  organization_id: string;
  data: {
    month?: string;
    total_fees?: number;
    total_amount?: number;
    overdue_count?: number;
    overdue_amount?: number;
    overdue_fees?: Array<{
      trainee_id: string;
      fee_amount: number;
      balance: number;
      due_date: string;
      days_overdue: number;
    }>;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, organization_id, data }: NotificationRequest = await req.json();

    console.log(`Sending ${type} notification for organization ${organization_id}`);

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      throw orgError;
    }

    // Get hostel coordinators for this organization
    const { data: coordinators, error: coordError } = await supabase
      .from('user_roles')
      .select('user_id, profiles(email, full_name)')
      .eq('organization_id', organization_id)
      .eq('role', 'hostel_coordinator');

    if (coordError) {
      console.error('Error fetching coordinators:', coordError);
      throw coordError;
    }

    if (!coordinators || coordinators.length === 0) {
      console.log('No hostel coordinators found for this organization');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No coordinators to notify' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const coordinatorEmails = coordinators
      .map((c: any) => {
        const profilesData = c.profiles;
        if (Array.isArray(profilesData) && profilesData.length > 0) {
          return profilesData[0].email;
        }
        return profilesData?.email;
      })
      .filter((email): email is string => !!email);

    if (coordinatorEmails.length === 0) {
      console.log('No coordinator emails found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No coordinator emails available' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let subject = '';
    let html = '';

    if (type === 'fees_generated') {
      const month = new Date(data.month!).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      subject = `Hostel Fees Generated for ${month}`;
      html = `
        <h2>Monthly Hostel Fees Generated</h2>
        <p>Dear Hostel Coordinator,</p>
        <p>The monthly hostel fees for <strong>${month}</strong> have been automatically generated.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Summary</h3>
          <p><strong>Organization:</strong> ${org.name}</p>
          <p><strong>Total Fee Records:</strong> ${data.total_fees}</p>
          <p><strong>Total Amount:</strong> R ${data.total_amount?.toFixed(2)}</p>
        </div>
        
        <p>Please review the fees and follow up on payments.</p>
        
        <p>Best regards,<br>
        ${org.name} Hostel Management System</p>
      `;
    } else if (type === 'fees_overdue') {
      subject = `Overdue Hostel Fees Alert`;
      
      const overdueList = data.overdue_fees?.map(fee => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${fee.trainee_id}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">R ${fee.fee_amount.toFixed(2)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">R ${fee.balance.toFixed(2)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${new Date(fee.due_date).toLocaleDateString()}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: red;">${fee.days_overdue} days</td>
        </tr>
      `).join('') || '';

      html = `
        <h2>Overdue Hostel Fees Alert</h2>
        <p>Dear Hostel Coordinator,</p>
        <p>There are currently <strong style="color: red;">${data.overdue_count}</strong> overdue hostel fee records requiring attention.</p>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin-top: 0;">Summary</h3>
          <p><strong>Organization:</strong> ${org.name}</p>
          <p><strong>Overdue Records:</strong> ${data.overdue_count}</p>
          <p><strong>Total Outstanding:</strong> R ${data.overdue_amount?.toFixed(2)}</p>
        </div>
        
        ${data.overdue_fees && data.overdue_fees.length > 0 ? `
          <h3>Overdue Details:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Trainee ID</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Fee Amount</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Balance</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Due Date</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              ${overdueList}
            </tbody>
          </table>
        ` : ''}
        
        <p><strong>Action Required:</strong> Please contact these trainees to arrange payment.</p>
        
        <p>Best regards,<br>
        ${org.name} Hostel Management System</p>
      `;
    }

    // Send emails to all coordinators using Resend API
    const emailPromises = coordinatorEmails.map(async (email) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Hostel Management <onboarding@resend.dev>',
          to: [email],
          subject: subject,
          html: html,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email to ${email}: ${response.statusText}`);
      }

      return response.json();
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Sent ${successful} emails successfully, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification sent to ${successful} coordinator(s)`,
        sent: successful,
        failed: failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in send-hostel-notification function:', error);
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
