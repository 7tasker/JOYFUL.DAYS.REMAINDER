import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "joyful-days",
  apiKey: "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw",
  authDomain: "joyful-days.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');

async function test() {
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`users collection count: ${usersSnap.size}`);
  usersSnap.docs.forEach(doc => {
      console.log('User:', doc.id, doc.data());
  });
}

test().catch(console.error).then(() => process.exit(0));
