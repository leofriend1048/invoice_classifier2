import { supabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

// WARNING: This bypasses Better Auth hooks. Use only if Better Auth admin delete is not available.
// TODO: Add admin authentication check here!
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  
  if (!id) {
    return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
  }
  
  console.log('Attempting to delete user:', id);
  
  try {
    // Delete all related data in the correct order to avoid FK constraints
    
    // 1. Delete sessions first
    console.log('Deleting sessions for user:', id);
    const { error: sessionError } = await supabaseServer
      .from('session')
      .delete()
      .eq('userId', id);
    if (sessionError) {
      console.error('Error deleting sessions:', sessionError);
      throw sessionError;
    }
    
    // 2. Delete accounts
    console.log('Deleting accounts for user:', id);
    const { error: accountError } = await supabaseServer
      .from('account')
      .delete()
      .eq('userId', id);
    if (accountError) {
      console.error('Error deleting accounts:', accountError);
      throw accountError;
    }
    
    // 3. Delete verification tokens (if any)
    console.log('Deleting verification tokens for user:', id);
    const { error: verificationError } = await supabaseServer
      .from('verification')
      .delete()
      .eq('userId', id);
    if (verificationError) {
      console.error('Error deleting verification tokens:', verificationError);
      // Don't throw here as verification table might not exist or have different structure
    }
    
    // 4. Finally delete the user
    console.log('Deleting user:', id);
    const { error: userError } = await supabaseServer
      .from('user')
      .delete()
      .eq('id', id);
    if (userError) {
      console.error('Error deleting user:', userError);
      throw userError;
    }
    
    console.log('Successfully deleted user:', id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete user:', id, error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to delete user'
    }, { status: 500 });
  }
} 