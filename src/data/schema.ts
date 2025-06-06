import { z } from "zod"

export const invoiceSchema = z.object({
  id: z.string(),
  vendor_name: z.string(),
  invoice_date: z.string(),
  due_date: z.string().optional(),
  amount: z.number(),
  status: z.string(),
  gl_account: z.string(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  branch: z.string(),
  division: z.string().default('Ecommerce'),
  payment_method: z.string(),
  description: z.string().optional(),
  pdf_url: z.string().optional(),
  extracted_text: z.string().optional(),
  classification_suggestion: z.any().optional(),
  confidence: z.number().optional(),
  updated_at: z.string().optional(),
  is_paid: z.boolean().default(false),
})

export type Invoice = z.infer<typeof invoiceSchema>

export const invoice_statuses = [
  { value: "pending", label: "Pending", description: "New, awaiting review", variant: "neutral" },
  { value: "approved", label: "Approved", description: "Reviewed and ready for AP", variant: "success" },
  { value: "rejected", label: "Rejected", description: "Not valid invoices", variant: "destructive" },
]

export const categories = [
  "Advertising",
  "Content Creation",
  "Retention Marketing",
  "Marketing Analytics & Optimization",
  "Web & Product Technology",
  "Operations"
]

export const subcategories: Record<string, string[]> = {
  "Advertising": [
    "Media Buying",
    "Ad Production – Service",
    "Ad Production – Platform",
    "Copywriting"
  ],
  "Content Creation": [
    "UGC Creator – Freelancer",
    "Photography – Freelancer",
    "Creator Sourcing Platform",
    "Creator Sourcing – Service"
  ],
  "Retention Marketing": [
    "Retention – SaaS",
    "Email Creative – Freelancer"
  ],
  "Marketing Analytics & Optimization": [
    "Attribution & Analytics",
    "Conversion Optimization"
  ],
  "Web & Product Technology": [
    "CMS / No-Code Tools",
    "Web Dev – Agency/Freelance",
    "Hosting & Infra Tools",
    "AI Tools – Creative"
  ],
  "Operations": [
    "Returns & Post-Purchase",
    "Recruiting",
    "Moderation",
    "Translation",
    "Legal/Docs – SaaS",
    "Team Tools – SaaS"
  ]
}

// Subcategory descriptions (for OpenAI prompt):
export const subcategoryDescriptions: Record<string, Record<string, string>> = {
  "Advertising": {
    "Media Buying": "Paid acquisition via freelancers or agencies (e.g., Facebook, Google, YouTube)",
    "Ad Production – Service": "Freelancers or agencies involved in video editing, UGC production, or content creation",
    "Ad Production – Platform": "AI tools or SaaS platforms for generating video, voice, or creative assets (e.g., Eleven Labs, Opus Pro)",
    "Copywriting": "Freelance or agency writers for ads, scripts, landing pages"
  },
  "Content Creation": {
    "UGC Creator – Freelancer": "Individuals creating UGC-style or testimonial content",
    "Photography – Freelancer": "Product or brand photography",
    "Creator Sourcing Platform": "Tools or agencies that help source and manage creators",
    "Creator Sourcing – Service": "Agencies or freelancers that provide a service to source creators for brands"
  },
  "Retention Marketing": {
    "Retention – SaaS": "Email, SMS, or Direct Mail platforms (e.g., Klaviyo, PostPilot, Sendlane, Attentive)",
    "Email Creative – Freelancer": "Designers or developers who produce emails"
  },
  "Marketing Analytics & Optimization": {
    "Attribution & Analytics": "Tools tracking paid marketing efficiency (e.g., Northbeam, Source Medium)",
    "Conversion Optimization": "A/B testing, CRO tools or agencies (e.g., Convert.com, Power Digital)"
  },
  "Web & Product Technology": {
    "CMS / No-Code Tools": "Web builders and content platforms (e.g., Webflow, Builder.io)",
    "Web Dev – Agency/Freelance": "All external web development talent (e.g., Techyscouts, Anesti Gjikoka)",
    "Hosting & Infra Tools": "Backend infrastructure, hosting, version control (e.g., Vercel, GitHub, Supabase)",
    "AI Tools – Creative": "Generative AI tools for video, images, or voice (e.g., Arcads, Replicate, Maverick Lab)"
  },
  "Operations": {
    "Returns & Post-Purchase": "Platforms that handle returns or customer logistics (e.g., Loop Returns)",
    "Recruiting": "Freelancers or platforms that help source team members",
    "Moderation": "Social moderation freelancers (e.g., Francesca Pamintuan)",
    "Translation": "Localization services (e.g., Lea Malzl)",
    "Legal/Docs – SaaS": "PDF or signature tools (e.g., Smallpdf)",
    "Team Tools – SaaS": "Time tracking, meeting notes, testing platforms (e.g., Everhour, Fellow.app, HackerRank, Motion)"
  }
}

export const merchants = [
  "Adobe",
  "AliExpress",
  "Amazon",
  "Amazon Advertising",
  "American Airlines",
  "Apple",
  "Best Buy",
  "Delta Air Lines",
  "DoorDash",
  "Facebook Ads",
  "FedEx",
  "Google Ads",
  "Google G Suite",
  "Linkedin",
  "Lyft",
  "Microsoft",
  "Starbucks",
  "The Home Depot",
  "Twilio",
  "Uber",
  "Uber Eats",
  "Uber HQ",
  "United Airlines",
  "USPS",
  "Walmart",
]

export const expense_statuses = [
  {
    value: "approved",
    label: "Approved",
    variant: "success",
    weight: 0.9,
  },
  {
    value: "pending",
    label: "Pending",
    variant: "neutral",
    weight: 0.05,
  },
  {
    value: "actionRequired",
    label: "Action required",
    variant: "error",
    weight: 0.04,
  },
  {
    value: "inAudit",
    label: "In audit",
    variant: "warning",
    weight: 0.01,
  },
]

export const payment_statuses = [
  {
    value: "processing",
    label: "Processing",
    weight: 0.01,
  },
  {
    value: "cleared",
    label: "Cleared",
    weight: 0.99,
  },
]

export const currencies = [
  {
    value: "usd",
    label: "USD",
    weight: 0.85,
  },
  {
    value: "eur",
    label: "EUR",
    weight: 0.15,
  },
]

export const locations = [
  {
    name: "Africa",
    countries: [
      "Nigeria",
      "Ethiopia",
      "Egypt",
      "South Africa",
      "Kenya",
      "Uganda",
    ],
    weight: 10,
  },
  {
    name: "Asia",
    countries: [
      "China",
      "India",
      "Indonesia",
      "Japan",
      "Philippines",
      "Vietnam",
      "Thailand",
      "South Korea",
      "Iraq",
      "Saudi Arabia",
      "Uzbekistan",
      "Malaysia",
      "Nepal",
      "Sri Lanka",
    ],
    weight: 10,
  },
  {
    name: "Europe",
    countries: [
      "Germany",
      "France",
      "United Kingdom",
      "Italy",
      "Spain",
      "Poland",
      "Netherlands",
      "Belgium",
      "Czech Republic",
      "Greece",
      "Portugal",
      "Switzerland",
      "Austria",
      "Sweden",
      "Hungary",
      "Denmark",
      "Norway",
    ],
    weight: 25,
  },
  {
    name: "North America",
    countries: [
      "United States",
      "Canada",
      "Mexico",
      "Guatemala",
      "Honduras",
      "El Salvador",
    ],
    weight: 25,
  },
  {
    name: "South America",
    countries: [
      "Brazil",
      "Argentina",
      "Colombia",
      "Chile",
      "Peru",
      "Venezuela",
    ],
    weight: 10,
  },
  {
    name: "Australia",
    countries: ["Australia", "New Zealand", "Fiji"],
    weight: 10,
  },
]
