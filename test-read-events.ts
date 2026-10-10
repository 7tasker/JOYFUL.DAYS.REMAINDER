import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "joyful-days",
  apiKey: "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw",
  authDomain: "joyful-days.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');

async function test() {
  const userEvent = await getDocs(collection(db, 'users', 'test-user-123', 'events'));
  console.log('users/test-user-123/events size:', userEvent.size);
  if (!userEvent.empty) console.log(userEvent.docs[0].id, userEvent.docs[0].data());
  
  const rootEvents = await getDocs(collection(db, 'events'));
  console.log('root /events size:', rootEvents.size);
  if (!rootEvents.empty) console.log(rootEvents.docs[0].id, rootEvents.docs[0].data());
}

test().catch(console.error).then(() => process.exit(0));
