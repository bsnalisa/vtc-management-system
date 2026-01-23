import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocumentRequest {
  documentType: "invoice" | "report" | "certificate" | "form" | "letter";
  templateName: string;
  data: Record<string, any>;
  organizationId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { documentType, templateName, data, organizationId }: DocumentRequest = await req.json();

    console.log(`Generating ${documentType} document for organization ${organizationId}`);

    // Generate HTML content based on template
    const htmlContent = generateHTML(documentType, templateName, data);

    // Convert HTML to PDF using a PDF generation service
    // For production, integrate with a service like:
    // - PDFKit (Deno-compatible)
    // - Puppeteer via API
    // - html-pdf-node
    // For now, we'll create a placeholder PDF structure

    const pdfBuffer = await generatePDF(htmlContent);

    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${documentType}_${templateName}_${timestamp}.pdf`;
    const filePath = `${organizationId}/${documentType}/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Record in database
    const { data: documentRecord, error: dbError } = await supabase
      .from("generated_documents")
      .insert([
        {
          organization_id: organizationId,
          document_type: documentType,
          template_name: templateName,
          file_path: filePath,
          file_name: fileName,
          generated_by: user.id,
          metadata: data,
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw dbError;
    }

    // Get signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return new Response(
      JSON.stringify({
        success: true,
        document: documentRecord,
        downloadUrl: signedUrl?.signedUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("PDF generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateHTML(
  documentType: string,
  templateName: string,
  data: Record<string, any>
): string {
  // Base HTML structure with styling
  const baseStyles = `
    <style>
      @page { margin: 2cm; }
      body { 
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .header {
        text-align: center;
        margin-bottom: 2em;
        border-bottom: 2px solid #333;
        padding-bottom: 1em;
      }
      .content {
        margin: 2em 0;
      }
      .footer {
        margin-top: 3em;
        padding-top: 1em;
        border-top: 1px solid #ccc;
        font-size: 0.9em;
        color: #666;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f4f4f4;
      }
    </style>
  `;

  // Template-specific content
  let content = "";

  switch (documentType) {
    case "invoice":
      content = generateInvoiceHTML(data);
      break;
    case "report":
      content = generateReportHTML(data);
      break;
    case "certificate":
      content = generateCertificateHTML(data);
      break;
    case "form":
      content = generateFormHTML(data);
      break;
    case "letter":
      content = generateLetterHTML(data);
      break;
    default:
      content = `<div class="content"><p>Unknown document type: ${documentType}</p></div>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyles}
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
}

function generateInvoiceHTML(data: Record<string, any>): string {
  return `
    <div class="header">
      <h1>INVOICE</h1>
      <p>Invoice No: ${data.invoiceNumber || "N/A"}</p>
      <p>Date: ${data.date || new Date().toLocaleDateString()}</p>
    </div>
    <div class="content">
      <h3>Bill To:</h3>
      <p>${data.billTo?.name || "N/A"}<br>
      ${data.billTo?.address || ""}<br>
      ${data.billTo?.email || ""}</p>
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${(data.items || []).map((item: any) => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${item.unitPrice}</td>
              <td>${item.amount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="text-align: right; margin-top: 2em;">
        <strong>Total: ${data.total || "0.00"}</strong>
      </div>
    </div>
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
  `;
}

function generateReportHTML(data: Record<string, any>): string {
  return `
    <div class="header">
      <h1>${data.title || "REPORT"}</h1>
      <p>Period: ${data.period || "N/A"}</p>
    </div>
    <div class="content">
      ${data.sections?.map((section: any) => `
        <h2>${section.title}</h2>
        <p>${section.content}</p>
      `).join('') || '<p>No content available</p>'}
    </div>
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
  `;
}

function generateCertificateHTML(data: Record<string, any>): string {
  return `
    <div style="text-align: center; padding: 4em 2em;">
      <h1 style="font-size: 2.5em; margin-bottom: 1em;">CERTIFICATE OF COMPLETION</h1>
      <p style="font-size: 1.2em; margin: 2em 0;">This is to certify that</p>
      <h2 style="font-size: 2em; margin: 1em 0;">${data.recipientName || "N/A"}</h2>
      <p style="font-size: 1.2em; margin: 2em 0;">has successfully completed</p>
      <h3 style="font-size: 1.5em; margin: 1em 0;">${data.courseName || "N/A"}</h3>
      <p style="margin-top: 3em;">Date: ${data.completionDate || new Date().toLocaleDateString()}</p>
    </div>
  `;
}

function generateFormHTML(data: Record<string, any>): string {
  return `
    <div class="header">
      <h1>${data.formTitle || "FORM"}</h1>
    </div>
    <div class="content">
      ${Object.entries(data.fields || {}).map(([key, value]) => `
        <p><strong>${key}:</strong> ${value}</p>
      `).join('')}
    </div>
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
  `;
}

function generateLetterHTML(data: Record<string, any>): string {
  return `
    <div style="margin: 2em;">
      <p>${data.date || new Date().toLocaleDateString()}</p>
      <p style="margin-top: 2em;">${data.recipientName || ""}<br>
      ${data.recipientAddress || ""}</p>
      <p style="margin-top: 2em;"><strong>${data.subject || "Subject"}</strong></p>
      <div style="margin-top: 2em; text-align: justify;">
        ${data.body || ""}
      </div>
      <p style="margin-top: 3em;">Sincerely,<br><br>
      ${data.senderName || ""}<br>
      ${data.senderTitle || ""}</p>
    </div>
  `;
}

async function generatePDF(htmlContent: string): Promise<Uint8Array> {
  // Placeholder PDF generation
  // In production, use a proper PDF library or service
  
  // For now, return a simple text representation
  // In production, replace with actual PDF generation library
  const textContent = `
PDF Document
============
${htmlContent.replace(/<[^>]*>/g, '')}
============
Generated by VTC Management System
  `;
  
  const encoder = new TextEncoder();
  return encoder.encode(textContent);
}
