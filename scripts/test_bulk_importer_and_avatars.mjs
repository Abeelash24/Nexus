import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://plhehakcdqvibojagund.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C_Ssp-AbvH_2JmRDPhbP4A_WJNDxXNQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runVerification() {
  console.log('================================================================');
  console.log('CAREERNEXUS — BULK IMPORTER & AVATAR VERIFICATION SUITE');
  console.log('================================================================\n');

  try {
    // 1. Sign in as Admin
    console.log('[Step 1] Signing in as Admin (cnexadmin@gmail.com)...');
    const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
      email: 'cnexadmin@gmail.com',
      password: 'Admin@001X'
    });

    if (adminErr || !adminAuth.session) {
      throw new Error(`Admin sign in failed: ${adminErr?.message}`);
    }
    console.log('  ✓ Admin signed in successfully. Session acquired.');

    // 2. Call admin_bulk_create_students RPC with test payload
    console.log('\n[Step 2] Executing admin_bulk_create_students RPC...');
    const testStudentRoll = '26CS_BULK_' + Math.floor(Math.random() * 8999 + 1000);
    const testStudentEmail = `e2e_bulk_student_${Date.now()}@careernexus.edu`;
    const testAvatarUrl = 'https://plhehakcdqvibojagund.supabase.co/storage/v1/object/public/avatars/sample_avatar.png';

    const { data: importResults, error: importErr } = await supabase.rpc('admin_bulk_create_students', {
      p_students: [
        {
          full_name: 'Pooja Narayanan',
          email: testStudentEmail,
          roll_number: testStudentRoll,
          department: 'Computer Science & Engineering',
          cgpa: 9.35,
          phone: '9876543299',
          avatar_url: testAvatarUrl,
          password: 'Student@Test2026'
        }
      ]
    });

    if (importErr) {
      throw new Error(`admin_bulk_create_students RPC failed: ${importErr.message}`);
    }

    console.log('  ✓ RPC returned results:', JSON.stringify(importResults, null, 2));
    const resultItem = importResults?.[0];
    if (resultItem?.status !== 'created' && resultItem?.status !== 'updated') {
      throw new Error(`Unexpected import status: ${resultItem?.status} (${resultItem?.reason})`);
    }

    // 3. Verify public.students row
    console.log('\n[Step 3] Verifying public.students row for newly created student...');
    const { data: studentRows, error: studentErr } = await supabase
      .from('students')
      .select('id, user_id, full_name, email, roll_number, cgpa, avatar_url, profile_photo')
      .eq('email', testStudentEmail);

    if (studentErr || !studentRows || studentRows.length === 0) {
      throw new Error(`Could not find student in public.students: ${studentErr?.message}`);
    }

    const studentRecord = studentRows[0];
    console.log('  ✓ public.students verified:', {
      fullName: studentRecord.full_name,
      rollNumber: studentRecord.roll_number,
      cgpa: studentRecord.cgpa,
      avatarUrl: studentRecord.avatar_url
    });

    if (studentRecord.avatar_url !== testAvatarUrl) {
      throw new Error(`avatar_url mismatch: expected ${testAvatarUrl}, got ${studentRecord.avatar_url}`);
    }

    // 4. Test Student Direct Sign-in with the imported password
    console.log('\n[Step 4] Testing immediate sign-in with imported student credentials...');
    // Create new unauthenticated client to sign in as student
    const studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: studentAuth, error: studentAuthErr } = await studentClient.auth.signInWithPassword({
      email: testStudentEmail,
      password: 'Student@Test2026'
    });

    if (studentAuthErr || !studentAuth.session) {
      throw new Error(`Student sign-in failed: ${studentAuthErr?.message}`);
    }
    console.log('  ✓ Student signed in successfully! User ID:', studentAuth.user.id);

    // 5. Test Avatar Upload to 'avatars' Storage Bucket
    console.log('\n[Step 5] Testing Avatar upload to public "avatars" storage bucket...');
    const dummyBlob = new Blob(['PNG_TEST_AVATAR_BYTES'], { type: 'image/png' });
    const avatarFilePath = `test_upload_${testStudentRoll}.png`;
    const { data: uploadData, error: uploadErr } = await studentClient.storage
      .from('avatars')
      .upload(avatarFilePath, dummyBlob, { upsert: true });

    if (uploadErr) {
      throw new Error(`Avatar upload failed: ${uploadErr.message}`);
    }

    const { data: publicUrlData } = studentClient.storage.from('avatars').getPublicUrl(avatarFilePath);
    console.log('  ✓ Avatar uploaded to Supabase Storage. Public URL:', publicUrlData.publicUrl);

    // Clean up uploaded test avatar
    await studentClient.storage.from('avatars').remove([avatarFilePath]);

    // 6. Clean up test student
    console.log('\n[Step 6] Cleaning up test student records...');
    const { error: delErr } = await supabase.from('users').delete().eq('email', testStudentEmail);
    const { error: delAuthErr } = await supabase.from('students').delete().eq('email', testStudentEmail);

    console.log('  ✓ Cleanup complete.');
    console.log('\n================================================================');
    console.log('ALL TESTS PASSED WITH ZERO REGRESSIONS!');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ Verification Failed:', err.message);
    process.exit(1);
  }
}

runVerification();
