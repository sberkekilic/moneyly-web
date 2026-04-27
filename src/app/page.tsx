import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function RootPage() {
  // Check if onboarding is complete
  // In web we use cookies or just redirect to setup
  redirect('/setup');
}