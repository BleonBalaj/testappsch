export function passwordRecoveryMessage(error) {
  const code = error?.code;
  if (code === 'functions/not-found' || code === 'auth/user-not-found') return 'Email not found. No account is registered with this email address.';
  if (code === 'functions/resource-exhausted' || code === 'auth/too-many-requests') return 'Too many recovery attempts. Please wait 15 minutes and try again.';
  if (code === 'functions/invalid-argument' || code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'functions/failed-precondition' || code === 'auth/user-disabled') return 'This account is disabled. Please contact your school administrator.';
  return 'Could not send the password reset email. Please check your connection and try again.';
}

/** Only show success after server verification AND Firebase accepts the email. */
export async function requestVerifiedPasswordReset(email, { verifyAccount, sendReset }) {
  const normalized = String(email || '').trim().toLowerCase();
  try {
    const response = await verifyAccount({ email: normalized });
    if (response?.data?.verified !== true) throw new Error('Account verification did not complete.');
    await sendReset(normalized);
  } catch (error) {
    const failure = new Error(passwordRecoveryMessage(error));
    failure.code = error?.code;
    throw failure;
  }
}
