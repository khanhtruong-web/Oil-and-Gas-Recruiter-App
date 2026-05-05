import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function migrate() {
    console.log("Migrating activities...");
    const snap = await getDocs(collection(db, 'activities'));
    let count = 0;
    for (const d of snap.docs) {
        const data = d.data();
        if (typeof data.timestamp === 'string') {
            await updateDoc(doc(db, 'activities', d.id), {
                timestamp: Timestamp.fromDate(new Date(data.timestamp))
            });
            count++;
            console.log(`Updated ${d.id}`);
        } else if (!data.timestamp) {
            await updateDoc(doc(db, 'activities', d.id), {
                timestamp: Timestamp.fromDate(new Date("2026-05-01T00:00:00Z"))
            });
            count++;
            console.log(`Updated null ts ${d.id}`);
        }
    }
    console.log(`Migrated ${count} activities.`);
    process.exit(0);
}
migrate().catch(console.error);
