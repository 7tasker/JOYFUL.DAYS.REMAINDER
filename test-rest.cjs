const fs = require('fs');
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json'));
const key = config.apiKey;
fetch(`https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/users/test-user-123/events?key=${key}`).then(r => r.json()).then(console.log);
fetch(`https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/reviews?key=${key}`).then(r => r.json()).then(console.log);
fetch(`https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/users?key=${key}`).then(r => r.json()).then(console.log);
