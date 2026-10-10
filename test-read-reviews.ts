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
  const reviewsSnap = await getDocs(collection(db, 'reviews'));
  console.log(`reviews collection count: ${reviewsSnap.size}`);
  if (!reviewsSnap.empty) {
      console.log('Sample from reviews:', reviewsSnap.docs[0].id, reviewsSnap.docs[0].data());
  }

  const userReviewsSnap = await getDocs(collection(db, 'user_reviews'));
  console.log(`user_reviews collection count: ${userReviewsSnap.size}`);
  if (!userReviewsSnap.empty) {
      console.log('Sample from user_reviews:', userReviewsSnap.docs[0].id, userReviewsSnap.docs[0].data());
  }
}

test().catch(console.error).then(() => process.exit(0));
