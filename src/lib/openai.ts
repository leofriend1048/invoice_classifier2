import { categories, subcategories, subcategoryDescriptions } from "@/data/schema";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON Schema for invoice extraction
const invoiceExtractionSchema = {
  type: "object",
  properties: {
    vendor_name: {
      type: ["string", "null"],
      description: "The company or vendor name from the invoice"
    },
    invoice_date: {
      type: ["string", "null"],
      description: "Invoice date in YYYY-MM-DD format"
    },
    due_date: {
      type: ["string", "null"],
      description: "Due date in YYYY-MM-DD format"
    },
    amount: {
      type: ["number", "null"],
      description: "Total invoice amount as a number"
    },
    extracted_text: {
      type: ["string", "null"],
      description: "All text content extracted from the document"
    }
  },
  required: ["vendor_name", "invoice_date", "due_date", "amount", "extracted_text"],
  additionalProperties: false
};

// JSON Schema for classification
const classificationSchema = {
  type: "object",
  properties: {
    gl_account: {
      type: ["string", "null"],
      description: "Full GL code (e.g., 618000-00)"
    },
    category: {
      type: ["string", "null"],
      description: "Main business category (e.g., Marketing, Office Supplies, Professional Services, Technology, Travel)"
    },
    subcategory: {
      type: ["string", "null"],
      description: "Specific subcategory within the main category"
    },
    description: {
      type: ["string", "null"],
      description: "Brief description of what this invoice is for"
    },
    branch: {
      type: ["string", "null"],
      description: "Branch (e.g., Michael Todd Beauty or NasalFresh MD)"
    },
    division: {
      type: ["string", "null"],
      description: "Division (always 'Ecommerce')"
    },
    payment_method: {
      type: ["string", "null"],
      description: "Payment method (ACH, Credit Card, Wire, Paypal, Check, or blank if not found)"
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence score between 0 and 1"
    }
  },
  required: ["gl_account", "category", "subcategory", "description", "branch", "division", "payment_method", "confidence"],
  additionalProperties: false
};

// Add arrays for GL account, branch, and payment method options
const glAccountOptions = [
  "618000-00", "606250-40", "687500-00", "6880000-00", "688000-00", "604000-40", "689500-00", "601600-40", "601500-40"
];
const branchOptions = [
  "Michael Todd Beauty", "NasalFresh MD"
];
const paymentMethodOptions = [
  "ACH", "Credit Card", "Wire", "Paypal", "Check"
];

export async function extractInvoiceDataWithGPT4o(
  fileUrl: string
): Promise<{
  vendor_name?: string;
  invoice_date?: string;
  due_date?: string;
  amount?: number;
  extracted_text?: string;
} | null> {
  try {
    console.log('🤖 Starting GPT-4o document processing...');
    console.log('📄 File URL:', fileUrl);
    console.log('🔑 OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key is missing');
      return null;
    }

    // Download the file content
    console.log('📥 Downloading file content...');
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      console.error('❌ Failed to download file:', fileResponse.status);
      return null;
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const base64String = Buffer.from(fileBuffer).toString('base64');
    const contentType = fileResponse.headers.get('content-type') || 'application/pdf';
    
    console.log('📊 File downloaded successfully');
    console.log('📋 Content type:', contentType);
    console.log('📦 File size:', fileBuffer.byteLength, 'bytes');

    console.log('📤 Sending document to OpenAI GPT-4o with structured output...');
    
    // Use structured outputs to ensure valid JSON response
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze this invoice document (PDF) and extract the following information. If any field cannot be determined, set it to null. For dates, convert to YYYY-MM-DD format. For amount, extract only the final total as a number.`
            },
            {
              type: "file",
              file: {
                filename: "invoice.pdf",
                file_data: `data:${contentType};base64,${base64String}`
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "invoice_extraction",
          schema: invoiceExtractionSchema,
          strict: true
        }
      },
      max_tokens: 1500,
      temperature: 0.1
    });

    console.log('✅ Received structured response from OpenAI');
    const content = response.choices[0]?.message?.content;
    console.log('📝 Response content:', content);
    
    if (!content) {
      console.error('❌ No content in OpenAI response');
      return null;
    }

    // With structured outputs, we should always get valid JSON
    try {
      const extractedData = JSON.parse(content);
      console.log('✅ Successfully parsed extracted data:', extractedData);
      return extractedData;
    } catch (parseError) {
      console.error('❌ Failed to parse structured response (this should not happen):', parseError);
      console.error('📄 Raw response:', content);
      return null;
    }

  } catch (error) {
    console.error('💥 GPT-4o processing error:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    
    // Check if it's an OpenAI API error
    if (error && typeof error === 'object' && 'error' in error) {
      console.error('🔥 OpenAI API Error:', (error as { error: unknown }).error);
    }
    
    return null;
  }
}

export async function classifyInvoiceWithGPT4o(
  vendorName: string,
  amount: number,
  extractedText: string,
  uniqueCategories?: string[],
  vendorCategory?: string,
  vendorSubcategory?: string,
  descriptionOnly?: boolean
): Promise<{
  gl_account: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  branch: string | null;
  division: string | null;
  payment_method: string | null;
  confidence: number;
} | null> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`🤖 Starting GPT-4o classification attempt ${retryCount + 1}/${maxRetries}...`);
      console.log('🏢 Vendor:', vendorName);
      console.log('💰 Amount:', amount);

      let prompt = '';
      if (descriptionOnly) {
        prompt = `Given the following invoice text, generate a brief, clear description of what the invoice is for. Do not mention the word "invoice" in your response. Only return the description.`;
      } else {
        prompt = `Context: This is an invoice from ${vendorName}.
`;
        if (vendorCategory && vendorSubcategory) {
          prompt += `This vendor typically falls under: ${vendorCategory}/${vendorSubcategory}.
`;
        }
        prompt += `\nVendor: ${vendorName}\nAmount: $${amount}\nContent: ${extractedText.substring(0, 1000)}...\n\n`;
        if (uniqueCategories && uniqueCategories.length > 0) {
          prompt += `Available categories: ${categories.join(", ")}.\n`;
        }
        // Inject all subcategories for each category
        prompt += `Available subcategories by category:\n`;
        for (const cat of categories) {
          prompt += `- ${cat}: ${(subcategories[cat] || []).join(", ")}\n`;
        }
        // Add subcategory descriptions for context
        prompt += `\nSubcategory descriptions for context:\n`;
        for (const cat of categories) {
          if (subcategoryDescriptions[cat]) {
            for (const sub of Object.keys(subcategoryDescriptions[cat])) {
              prompt += `- ${cat} / ${sub}: ${subcategoryDescriptions[cat][sub]}\n`;
            }
          }
        }
        // Add decision tree logic
        prompt += `\nCategory/Subcategory Decision Tree (use these rules):\n`;
        prompt += `Does vendor provide services or tools related to PAID MEDIA? Keywords: Facebook, Google, YouTube, Adcrunch, media buyer. YES → Category: Advertising → Subcategory: Media Buying\n`;
        prompt += `Is this a freelancer or agency producing creative assets (video, UGC, images)? Keywords: video editor, UGC, creative agency, Tubescience, Eleven Labs, Decima Labs. YES → Category: Advertising → Subcategory: Ad Production – Service\n`;
        prompt += `Is the vendor an AI platform used for content (video, voice, image)? Keywords: Eleven Labs, Arcads, Maverick Lab, Opus Pro. YES → Category: Advertising → Subcategory: Ad Production – Platform\n`;
        prompt += `Is the vendor a freelance or agency copywriter? Keywords: copywriting, advertorial, script writing, Zero to One, Emily King. YES → Category: Advertising → Subcategory: Copywriting\n`;
        prompt += `Is the vendor a UGC creator or influencer? Keywords: ad content creator, testimonial, UGC, creator, actor. YES → Category: Content Creation → Subcategory: UGC Creator – Freelancer\n`;
        prompt += `Is this photography-specific? Keywords: photographer, photo, product shoot, Alexa Spiroff. YES → Category: Content Creation → Subcategory: Photography – Freelancer\n`;
        prompt += `Is this a tool or agency used to source creators? Keywords: Grapevine, creator platform, UGC sourcing, Mariana Santaloja. YES → Category: Content Creation → Subcategory: Creator Sourcing Platform\n`;
        prompt += `Is this an ESP/SMS/Direct Mail vendor? Keywords: Klaviyo, Attentive, Sendlane, Postpilot. YES → Category: Retention Marketing → Subcategory: Retention – SaaS\n`;
        prompt += `Is the vendor an email designer or graphic email creator? Keywords: email graphic designer, email templates, Abhishek Pandey. YES → Category: Retention Marketing → Subcategory: Email Creative – Freelancer\n`;
        prompt += `Is this for tracking or attribution of marketing performance? Keywords: Northbeam, Source Medium, Supermetrics. YES → Category: Marketing Analytics & Optimization → Attribution & Analytics\n`;
        prompt += `Is this for CRO or A/B testing? Keywords: Convert.com, Power Digital. YES → Category: Marketing Analytics & Optimization → Conversion Optimization\n`;
        prompt += `Is this a CMS, web builder, or landing page tool? Keywords: Webflow, Builder.io. YES → Category: Web & Product Technology → CMS / No-Code Tools\n`;
        prompt += `Is the vendor a dev or agency building sites or product pages? Keywords: developer, Techyscouts, Vaan Group, Anesti Gjikoka. YES → Category: Web & Product Technology → Web Dev – Agency/Freelance\n`;
        prompt += `Is this hosting, version control, or backend infra? Keywords: Vercel, GitHub, Supabase. YES → Category: Web & Product Technology → Hosting & Infra Tools\n`;
        prompt += `Is this an AI tool for content generation (non-ad production)? Keywords: Replicate, Arcads, Maverick Lab. YES → Category: Web & Product Technology → AI Tools – Creative\n`;
        prompt += `Is this a return handling platform? Keywords: Loop Returns. YES → Category: Operations → Returns & Post-Purchase\n`;
        prompt += `Is this for recruiting? Keywords: recruiting, The Starters, Janina Adap. YES → Category: Operations → Recruiting\n`;
        prompt += `Is this for moderation? Keywords: moderation, Francesca Pamintuan. YES → Category: Operations → Moderation\n`;
        prompt += `Is this translation/localization? Keywords: translation, German, Lea Malzl. YES → Category: Operations → Translation\n`;
        prompt += `Is this a document/PDF signing or legal SaaS? Keywords: Smallpdf, contract signing. YES → Category: Operations → Legal/Docs – SaaS\n`;
        prompt += `Is this a productivity, time tracking, or hiring platform? Keywords: Everhour, Fellow.app, HackerRank, Motion. YES → Category: Operations → Team Tools – SaaS\n`;
        prompt += `[DEFAULT] → Flag as 'Unclassified' or 'Needs Review'\n`;
        prompt += `Instructions:\n`;
        prompt += `1. Extract the following fields: gl_account (full GL code, e.g. 618000-00), category (business grouping), subcategory (specific function), description (brief, actionable, do not mention \"invoice\"), branch (\"Michael Todd Beauty\" or \"NasalFresh MD\"), payment_method (ACH, Credit Card, Wire, Paypal, Check, or blank if not found).\n`;
        prompt += `2. Always set division to \"Ecommerce\".\n`;
        prompt += `3. Return a JSON object with all fields above, plus a confidence score (0.0-1.0).\n`;
        prompt += `You must always select 'branch', 'gl_account', and 'payment_method' from the provided options. Never leave these blank.\n`;
        prompt += `Branch options: ${branchOptions.join(", ")}.\n`;
        prompt += `GL Account options: ${glAccountOptions.join(", ")}.\n`;
        prompt += `Payment method options: ${paymentMethodOptions.join(", ")}.\n`;
        prompt += `Infer the branch as the client/brand being billed in the invoice. If not explicit, infer from context.\n`;
        prompt += `Infer the GL account based on the category, subcategory, and invoice context. Pick the most relevant from the options.\n`;
        prompt += `Pick the most relevant payment method from the options, based on payment instructions or context.\n`;
        // Add explicit payment method inference rules and examples
        prompt += `\nPayment Method Inference Rules:\n`;
        prompt += `- If the invoice contains bank account, routing, or ACH/ABA numbers, set payment_method to 'ACH'.\n`;
        prompt += `- If it mentions 'Wire', set payment_method to 'Wire'.\n`;
        prompt += `- If it mentions 'Credit Card', set payment_method to 'Credit Card'.\n`;
        prompt += `- If it mentions 'Paypal', set payment_method to 'Paypal'.\n`;
        prompt += `- If it mentions 'Check', set payment_method to 'Check'.\n`;
        prompt += `- If multiple are present, pick the most likely based on context.\n`;
        prompt += `\nExamples:\n`;
        prompt += `Example 1:\nInvoice text: 'Bank: Wells Fargo Bank\nRouting number ACH/ABA: 121000248\nAccount number: 123456789'\nExpected payment_method: 'ACH'\n`;
        prompt += `Example 2:\nInvoice text: 'Wire transfer instructions: ...'\nExpected payment_method: 'Wire'\n`;
        prompt += `Example 3:\nInvoice text: 'Please pay by Credit Card at ...'\nExpected payment_method: 'Credit Card'\n`;
        prompt += `Example 4:\nInvoice text: 'Make checks payable to ...'\nExpected payment_method: 'Check'\n`;
        prompt += `Example 5:\nInvoice text: 'Paypal payment to ...'\nExpected payment_method: 'Paypal'\n`;
        // Add explicit rules and examples for branch, GL account, category, subcategory
        prompt += `\nBranch Inference Rules:\n`;
        prompt += `- If the invoice is addressed to or references a specific brand/client (e.g., 'Michael Todd Beauty', 'NasalFresh MD'), set branch to that value.\n`;
        prompt += `- If multiple brands are mentioned, pick the one being billed or receiving the service.\n`;
        prompt += `- If not explicit, infer from the vendor, email context, or default to the most likely.\n`;
        prompt += `Example: Invoice text: 'Bill To: Michael Todd Beauty' → branch: 'Michael Todd Beauty'\n`;
        prompt += `\nGL Account Inference Rules:\n`;
        prompt += `- Infer GL account based on the category, subcategory, and invoice context.\n`;
        prompt += `- Always pick the most relevant GL account from the provided options.\n`;
        prompt += `- If multiple GL accounts could apply, pick the one that best matches the description or subcategory.\n`;
        prompt += `- Never leave blank; always select from the list.\n`;
        prompt += `Example: Category: 'Marketing', Subcategory: 'Web Advertising Services' → gl_account: '606250-40'\n`;
        prompt += `\nCategory Inference Rules:\n`;
        prompt += `- Choose the category that best fits the overall business purpose of the invoice.\n`;
        prompt += `- Prefer categories from the provided list; only create a new one if none fit.\n`;
        prompt += `- If multiple categories could apply, pick the most specific or most frequently used for this vendor.\n`;
        prompt += `Example: Invoice for 'Google Ads' → category: 'Marketing'\n`;
        prompt += `\nSubcategory Inference Rules:\n`;
        prompt += `- Subcategory should be a more specific function within the chosen category.\n`;
        prompt += `- Prefer subcategories from the provided list; only create a new one if none fit.\n`;
        prompt += `- If the invoice describes multiple services, pick the primary one.\n`;
        prompt += `Example: Category: 'Marketing', Invoice for 'Facebook Ads' → subcategory: 'Paid Media'\n`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "invoice_classification",
            schema: classificationSchema,
            strict: true
          }
        },
        max_tokens: 400,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      console.log('📝 Classification response:', content);
      
      if (!content) {
        console.error('❌ No content in classification response');
        return null;
      }

      try {
        const classificationData = JSON.parse(content);
        console.log('✅ Successfully parsed classification data:', classificationData);
        return classificationData;
      } catch (parseError) {
        console.error('❌ Failed to parse structured classification response (this should not happen):', parseError);
        console.error('📄 Raw response:', content);
        return null;
      }

    } catch (error) {
      console.error(`💥 GPT-4o classification error (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        // Exponential backoff: wait longer between each retry
        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      return null;
    }
  }
  return null;
} 