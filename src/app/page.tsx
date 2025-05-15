
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/lop-hoc');
  // In a real app, you'd check auth status here and redirect to /login or /lop-hoc
  return null; 
}
