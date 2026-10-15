import { redirect } from 'next/navigation';
// The game remains vanilla Three.js. Only matchmaking needs a server route.
export default function Home() { redirect('/index.html'); }
