import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "joyful-days",
  apiKey: "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw",
  authDomain: "joyful-days.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');

async function test() {
  const triggerSnap = await getDoc(doc(db, 'user_review_triggers', 'qyaFjoOn8ESZ0VoinlA6KSNLLds1'));
  console.log('Trigger for real user exists:', triggerSnap.exists());
  if (triggerSnap.exists()) {
    console.log(triggerSnap.data());
  }

  const allTriggers = await getDocs(collection(db, 'user_review_triggers'));
  console.log(`user_review_triggers collection count: ${allTriggers.size}`);
}

test().catch(console.error).then(() => process.exit(0));
