
import { redirect } from 'next/navigation';

export default function OldPhuHuynhPage() {
  redirect('/cong-phu-huynh');
  // This page will no longer render content directly.
  // It redirects to the new parent portal page.
  return null;
}
