// If you see import errors for './openai' or './supabase-server', but the files exist, restart your TypeScript server or IDE. These are not actual code issues.
import { classifyInvoiceWithGPT4o } from './openai';
import { supabaseServer } from './supabase-server';

// Types for classification
export interface ClassificationResult {
  category: string;
  subcategory: string;
  description: string;
  confidence: number;
  method: 'pattern' | 'gpt4o' | 'hybrid' | 'vendor';
  pattern_id?: string;
  gl_account?: string | null;
  branch?: string | null;
  division?: string | null;
  payment_method?: string | null;
}

export interface ClassificationPattern {
  id: string;
  vendor_regex: string;
  amount_min?: number;
  amount_max?: number;
  text_contains?: string[];
  category: string;
  subcategory: string;
  description: string;
  confidence: number;
  usage_count: number;
  success_rate: number;
  created_at: string;
  updated_at: string;
  gl_account?: string | null;
  branch?: string | null;
  division?: string | null;
  payment_method?: string | null;
}

export interface VendorProfile {
  id: string;
  name: string;
  typical_category: string;
  average_invoice_amount: number;
  recurrence_behavior: string;
  auto_approval_confidence_threshold: number;
  created_at: string;
  updated_at: string;
}

/**
 * Main classification function that implements hybrid logic
 */
export async function classifyInvoice(
  vendorName: string,
  amount: number,
  extractedText: string
): Promise<ClassificationResult> {
  console.log('🔍 Starting invoice classification...');
  console.log('🏢 Vendor:', vendorName);
  console.log('💰 Amount:', amount);

  try {
    // Step 0: Fetch unique categories/subcategories from non-pending invoices
    const { data: catData, error: catError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('category, subcategory, status, vendor_name')
      .neq('status', 'pending');
    let uniqueCategories: string[] = [];
    let uniqueSubcategories: string[] = [];
    if (!catError && catData) {
      uniqueCategories = Array.from(new Set(catData.map((row: any) => row.category).filter(Boolean)));
      uniqueSubcategories = Array.from(new Set(catData.map((row: any) => row.subcategory).filter(Boolean)));
    }

    // Step 1: Vendor-level learning: check for previous non-pending invoices for this vendor
    const vendorInvoices = (catData || []).filter((row: any) => row.vendor_name === vendorName);
    const lastVendorInvoice = vendorInvoices.length > 0 ? vendorInvoices[vendorInvoices.length - 1] : null;
    if (lastVendorInvoice && lastVendorInvoice.category && lastVendorInvoice.subcategory) {
      // Use vendor's last category/subcategory, but generate new description
      const gptDesc = await classifyInvoiceWithGPT4o(
        vendorName,
        amount,
        extractedText,
        uniqueCategories,
        uniqueSubcategories,
        lastVendorInvoice.category,
        lastVendorInvoice.subcategory,
        true // description only
      );
      return {
        category: lastVendorInvoice.category,
        subcategory: lastVendorInvoice.subcategory,
        description: gptDesc?.description || '',
        confidence: 0.95,
        method: 'vendor',
        gl_account: gptDesc?.gl_account,
        branch: gptDesc?.branch,
        division: gptDesc?.division,
        payment_method: gptDesc?.payment_method,
      };
    }

    // Step 2: Try pattern-based classification
    console.log('📋 Attempting pattern-based classification...');
    const patternResult = await classifyWithPatterns(vendorName, amount, extractedText);
    
    // Step 3: Get GPT-4o classification with injected categories/subcategories
    console.log('🤖 Getting GPT-4o classification...');
    const gptResult = await classifyInvoiceWithGPT4o(
      vendorName,
      amount,
      extractedText,
      uniqueCategories,
      uniqueSubcategories
    );
    
    // Step 4: Apply hybrid logic
    console.log('🔀 Applying hybrid classification logic...');
    const hybridResult = await applyHybridLogic(patternResult, gptResult, vendorName);
    
    console.log('✅ Classification completed:', hybridResult);
    return hybridResult;
    
  } catch (error) {
    console.error('💥 Classification error:', error);
    // Fallback: return a basic classification
    return {
      category: 'Business Services',
      subcategory: 'Other',
      description: 'Requires manual classification',
      confidence: 0.3,
      method: 'hybrid',
      gl_account: null,
      branch: null,
      division: null,
      payment_method: null,
    };
  }
}

/**
 * Pattern-based classification using historical patterns
 */
async function classifyWithPatterns(
  vendorName: string,
  amount: number,
  extractedText: string
): Promise<ClassificationResult | null> {
  try {
    // Get all classification patterns
    const { data: patterns, error } = await supabaseServer
      .from('invoice_class_classification_patterns')
      .select('*')
      .order('success_rate', { ascending: false });

    if (error || !patterns || patterns.length === 0) {
      console.log('⚠️ No classification patterns found');
      return null;
    }

    console.log(`📊 Found ${patterns.length} classification patterns`);

    // Score each pattern against the invoice
    const scoredPatterns = patterns.map((pattern: ClassificationPattern) => {
      const score = calculatePatternScore(pattern, vendorName, amount, extractedText);
      return { pattern, score };
    }).filter((item: { pattern: ClassificationPattern; score: number }) => item.score > 0);

    if (scoredPatterns.length === 0) {
      console.log('⚠️ No patterns matched this invoice');
      return null;
    }

    // Get the best matching pattern
    const bestMatch = scoredPatterns.sort((a: { pattern: ClassificationPattern; score: number }, b: { pattern: ClassificationPattern; score: number }) => b.score - a.score)[0];
    console.log('🎯 Best pattern match:', bestMatch.pattern.category, 'Score:', bestMatch.score);

    // Update pattern usage
    await updatePatternUsage(bestMatch.pattern.id);

    return {
      category: bestMatch.pattern.category,
      subcategory: bestMatch.pattern.subcategory,
      description: bestMatch.pattern.description,
      confidence: Math.min(bestMatch.score * bestMatch.pattern.success_rate, 0.95),
      method: 'pattern',
      pattern_id: bestMatch.pattern.id,
      gl_account: bestMatch.pattern.gl_account,
      branch: bestMatch.pattern.branch,
      division: bestMatch.pattern.division,
      payment_method: bestMatch.pattern.payment_method,
    };

  } catch (error) {
    console.error('❌ Pattern classification error:', error);
    return null;
  }
}

/**
 * Calculate how well a pattern matches an invoice
 */
function calculatePatternScore(
  pattern: ClassificationPattern,
  vendorName: string,
  amount: number,
  extractedText: string
): number {
  let score = 0;

  try {
    // Vendor name regex match (most important factor)
    const vendorRegex = new RegExp(pattern.vendor_regex, 'i');
    if (vendorRegex.test(vendorName)) {
      score += 0.6; // 60% of score for vendor match
    }

    // Amount range check
    if (pattern.amount_min != null && pattern.amount_max != null) {
      if (amount >= pattern.amount_min && amount <= pattern.amount_max) {
        score += 0.2; // 20% for amount range
      }
    } else if (pattern.amount_min != null && amount >= pattern.amount_min) {
      score += 0.1; // 10% for minimum amount
    } else if (pattern.amount_max != null && amount <= pattern.amount_max) {
      score += 0.1; // 10% for maximum amount
    }

    // Text content matching
    if (pattern.text_contains && pattern.text_contains.length > 0) {
      const textLower = extractedText.toLowerCase();
      const matchedTerms = pattern.text_contains.filter(term => 
        textLower.includes(term.toLowerCase())
      );
      const textScore = (matchedTerms.length / pattern.text_contains.length) * 0.2;
      score += textScore; // Up to 20% for text matching
    }

    // Boost score based on pattern success rate
    score *= pattern.success_rate;

  } catch (error) {
    console.error('❌ Error calculating pattern score:', error);
    return 0;
  }

  return score;
}

/**
 * Update pattern usage statistics
 */
async function updatePatternUsage(patternId: string): Promise<void> {
  try {
    const { error } = await supabaseServer
      .from('invoice_class_classification_patterns')
      .update({
        usage_count: supabaseServer.rpc('increment_usage_count', { pattern_id: patternId }),
        updated_at: new Date().toISOString()
      })
      .eq('id', patternId);

    if (error) {
      console.error('❌ Failed to update pattern usage:', error);
    }
  } catch (error) {
    console.error('❌ Error updating pattern usage:', error);
  }
}

/**
 * Apply hybrid logic to combine pattern and GPT results
 */
async function applyHybridLogic(
  patternResult: ClassificationResult | null,
  gptResult: {
    category: string;
    subcategory: string;
    description: string;
    confidence: number;
    gl_account?: string | null;
    branch?: string | null;
    division?: string | null;
    payment_method?: string | null;
  } | null,
  vendorName: string
): Promise<ClassificationResult> {
  
  // Check vendor profile for historical data
  const vendorProfile = await getVendorProfile(vendorName);
  
  // Consider vendor profile in confidence calculation
  let vendorConfidenceBoost = 0;
  if (vendorProfile && vendorProfile.recurrence_behavior) {
    // Count how many invoices this vendor has had (dates separated by commas)
    const invoiceCount = vendorProfile.recurrence_behavior.split(',').length;
    if (invoiceCount > 3) {
      vendorConfidenceBoost = 0.1; // Small boost for frequent vendors
    }
  }
  
  // If we have a high-confidence pattern match, use it
  if (patternResult && patternResult.confidence > 0.8) {
    console.log('🎯 Using high-confidence pattern result');
    return {
      ...patternResult,
      confidence: Math.min(patternResult.confidence + vendorConfidenceBoost, 0.95),
      gl_account: patternResult.gl_account,
      branch: patternResult.branch,
      division: patternResult.division,
      payment_method: patternResult.payment_method,
    };
  }
  
  // If we have GPT result and no good pattern match, use GPT
  if (gptResult && (!patternResult || patternResult.confidence < 0.5)) {
    console.log('🤖 Using GPT-4o result');
    return {
      category: gptResult.category,
      subcategory: gptResult.subcategory,
      description: gptResult.description,
      confidence: Math.min(gptResult.confidence + vendorConfidenceBoost, 0.95),
      method: 'gpt4o',
      gl_account: gptResult.gl_account,
      branch: gptResult.branch,
      division: gptResult.division,
      payment_method: gptResult.payment_method,
    };
  }
  
  // If we have both results, blend them intelligently
  if (patternResult && gptResult) {
    console.log('🔀 Blending pattern and GPT results');
    
    // Prefer pattern for vendor/category, GPT for description
    const blendedConfidence = (patternResult.confidence + gptResult.confidence) / 2;
    
    return {
      category: patternResult.confidence > gptResult.confidence ? patternResult.category : gptResult.category,
      subcategory: patternResult.confidence > gptResult.confidence ? patternResult.subcategory : gptResult.subcategory,
      description: gptResult.description || patternResult.description,
      confidence: Math.min(blendedConfidence + vendorConfidenceBoost, 0.95),
      method: 'hybrid',
      pattern_id: patternResult.pattern_id,
      gl_account: patternResult.confidence > gptResult.confidence ? patternResult.gl_account : gptResult.gl_account,
      branch: patternResult.confidence > gptResult.confidence ? patternResult.branch : gptResult.branch,
      division: patternResult.confidence > gptResult.confidence ? patternResult.division : gptResult.division,
      payment_method: patternResult.confidence > gptResult.confidence ? patternResult.payment_method : gptResult.payment_method,
    };
  }
  
  // If we only have pattern result, use it
  if (patternResult) {
    console.log('📋 Using pattern result');
    return {
      ...patternResult,
      confidence: Math.min(patternResult.confidence + vendorConfidenceBoost, 0.95),
      gl_account: patternResult.gl_account,
      branch: patternResult.branch,
      division: patternResult.division,
      payment_method: patternResult.payment_method,
    };
  }
  
  // If we only have GPT result, use it
  if (gptResult) {
    console.log('🤖 Using GPT result as fallback');
    return {
      category: gptResult.category,
      subcategory: gptResult.subcategory,
      description: gptResult.description,
      confidence: Math.min((gptResult.confidence * 0.9) + vendorConfidenceBoost, 0.95), // Slightly reduce confidence for fallback
      method: 'gpt4o',
      gl_account: gptResult.gl_account,
      branch: gptResult.branch,
      division: gptResult.division,
      payment_method: gptResult.payment_method,
    };
  }
  
  // Ultimate fallback
  console.log('⚠️ Using fallback classification');
  return {
    category: 'Business Services',
    subcategory: 'Other',
    description: 'Requires manual classification',
    confidence: 0.3,
    method: 'hybrid',
    gl_account: null,
    branch: null,
    division: null,
    payment_method: null,
  };
}

/**
 * Get or create vendor profile
 */
async function getVendorProfile(vendorName: string): Promise<VendorProfile | null> {
  try {
    const { data: profile, error } = await supabaseServer
      .from('invoice_class_vendors')
      .select('*')
      .eq('name', vendorName)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error is OK
      console.error('❌ Error fetching vendor profile:', error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('❌ Error getting vendor profile:', error);
    return null;
  }
}

/**
 * Create or update vendor profile based on invoice data
 */
export async function updateVendorProfile(
  vendorName: string,
  category: string,
  subcategory: string,
  amount: number
): Promise<void> {
  try {
    console.log('👤 Updating vendor profile for:', vendorName);

    // Check if vendor exists
    const { data: existingVendor } = await supabaseServer
      .from('invoice_class_vendors')
      .select('*')
      .eq('name', vendorName)
      .single();

    if (existingVendor) {
      // Update existing vendor - simple approach for now
      const currentDate = new Date().toISOString();
      const currentBehavior = existingVendor.recurrence_behavior || '';
      const invoiceCount = currentBehavior ? currentBehavior.split(',').length : 0;
      const newInvoiceCount = invoiceCount + 1;
      
      // Calculate new average
      const currentAverage = existingVendor.average_invoice_amount || 0;
      const newAverageAmount = invoiceCount > 0 
        ? ((currentAverage * invoiceCount) + amount) / newInvoiceCount
        : amount;

      // Update recurrence behavior - just append the date
      const newRecurrenceBehavior = currentBehavior 
        ? `${currentBehavior},${currentDate}`
        : currentDate;

      await supabaseServer
        .from('invoice_class_vendors')
        .update({
          typical_category: category,
          average_invoice_amount: newAverageAmount,
          recurrence_behavior: newRecurrenceBehavior,
          updated_at: currentDate
        })
        .eq('name', vendorName);

      console.log('✅ Updated existing vendor profile');
    } else {
      // Create new vendor
      await supabaseServer
        .from('invoice_class_vendors')
        .insert({
          name: vendorName,
          typical_category: category,
          average_invoice_amount: amount,
          recurrence_behavior: new Date().toISOString(),
          auto_approval_confidence_threshold: 0.8 // Default threshold
        });

      console.log('✅ Created new vendor profile');
    }
  } catch (error) {
    console.error('❌ Error updating vendor profile:', error);
  }
}

/**
 * Learn new pattern from approved classification
 */
export async function learnFromApproval(
  vendorName: string,
  amount: number,
  extractedText: string,
  approvedCategory: string,
  approvedSubcategory: string,
  approvedDescription: string
): Promise<void> {
  try {
    console.log('🎓 Learning new pattern from approval...');

    // Create a new classification pattern
    const vendorRegex = escapeRegex(vendorName);
    const textKeywords = extractKeywords(extractedText, approvedCategory);

    const newPattern: Partial<ClassificationPattern> = {
      vendor_regex: vendorRegex,
      amount_min: Math.max(0, amount - (amount * 0.2)), // 20% variance
      amount_max: amount + (amount * 0.2),
      text_contains: textKeywords,
      category: approvedCategory,
      subcategory: approvedSubcategory,
      description: approvedDescription,
      confidence: 0.9, // High confidence for human-approved patterns
      usage_count: 1,
      success_rate: 1.0, // Start with 100% success rate
      gl_account: null,
      branch: null,
      division: null,
      payment_method: null,
    };

    await supabaseServer
      .from('invoice_class_classification_patterns')
      .insert(newPattern);

    console.log('✅ New classification pattern learned');
  } catch (error) {
    console.error('❌ Error learning from approval:', error);
  }
}

/**
 * Extract keywords from text for pattern matching
 */
function extractKeywords(text: string, category: string): string[] {
  const keywords: string[] = [];
  
  // Common business terms by category
  const categoryKeywords: { [key: string]: string[] } = {
    'Marketing': ['marketing', 'advertising', 'promotion', 'campaign', 'social media'],
    'Office Supplies': ['supplies', 'office', 'stationery', 'paper', 'pens'],
    'Professional Services': ['consulting', 'legal', 'accounting', 'advisory', 'professional'],
    'Technology': ['software', 'hardware', 'IT', 'technology', 'digital'],
    'Travel': ['travel', 'hotel', 'flight', 'transportation', 'accommodation']
  };

  // Add category-specific keywords
  if (categoryKeywords[category]) {
    keywords.push(...categoryKeywords[category]);
  }

  // Extract meaningful words from text (simplified)
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'use', 'man', 'new', 'now', 'way', 'may', 'say']);
  
  words.forEach(word => {
    if (!commonWords.has(word) && word.length > 3) {
      keywords.push(word);
    }
  });

  // Return unique keywords, limited to top 10
  return Array.from(new Set(keywords)).slice(0, 10);
}

/**
 * Escape special regex characters
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} 