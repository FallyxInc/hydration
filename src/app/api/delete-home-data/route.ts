import { NextRequest, NextResponse } from 'next/server';
import { rm } from 'fs/promises';
import { join } from 'path';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, Firestore } from 'firebase/firestore';
import { ref, listAll, deleteObject, FirebaseStorage } from 'firebase/storage';
import { getHomeIdentifier } from '@/lib/retirementHomeMapping';

export async function POST(request: NextRequest) {
  console.log('🗑️ [DELETE API] Starting home data deletion...');
  
  try {
    const { retirementHome } = await request.json();
    
    console.log('📊 [DELETE API] Request parameters:', { retirementHome });
    
    if (!retirementHome) {
      console.error('❌ [DELETE API] Missing retirement home parameter');
      return NextResponse.json({ error: 'Missing retirement home parameter' }, { status: 400 });
    }

    const homeIdentifier = getHomeIdentifier(retirementHome);
    console.log(`🏠 [DELETE API] Home identifier: ${homeIdentifier}`);

    // Delete Firebase Storage files
    if (storage) {
      try {
        console.log('🔥 [DELETE API] Starting Firebase Storage deletion...');
        const fbStorage = storage as FirebaseStorage;

        // Delete care-plans files
        const carePlansRef = ref(fbStorage, `retirement-homes/${homeIdentifier}/care-plans`);
        try {
          const carePlansList = await listAll(carePlansRef);
          for (const itemRef of carePlansList.items) {
            await deleteObject(itemRef);
            console.log(`✅ [DELETE API] Deleted Storage file: ${itemRef.fullPath}`);
          }
        } catch (error) {
          console.log('⚠️ [DELETE API] Care plans folder may not exist:', error);
        }

        // Delete hydration-data files
        const hydrationDataRef = ref(fbStorage, `retirement-homes/${homeIdentifier}/hydration-data`);
        try {
          const hydrationDataList = await listAll(hydrationDataRef);
          for (const itemRef of hydrationDataList.items) {
            await deleteObject(itemRef);
            console.log(`✅ [DELETE API] Deleted Storage file: ${itemRef.fullPath}`);
          }
        } catch (error) {
          console.log('⚠️ [DELETE API] Hydration data folder may not exist:', error);
        }

        console.log('✅ [DELETE API] Firebase Storage deletion completed');
      } catch (error) {
        console.log('⚠️ [DELETE API] Error deleting Firebase Storage files:', error);
      }
    } else {
      console.log('⚠️ [DELETE API] Firebase Storage not available');
    }

    // Delete Firestore documents
    if (db) {
      try {
        console.log('🔥 [DELETE API] Starting Firestore deletion...');
        const fbdb = db as Firestore;

        // Delete dashboard-data subcollection
        const dashboardDataRef = collection(fbdb, 'retirement-homes', homeIdentifier, 'dashboard-data');
        try {
          const dashboardDocs = await getDocs(dashboardDataRef);
          for (const docSnapshot of dashboardDocs.docs) {
            await deleteDoc(docSnapshot.ref);
            console.log(`✅ [DELETE API] Deleted Firestore document: dashboard-data/${docSnapshot.id}`);
          }
        } catch (error) {
          console.log('⚠️ [DELETE API] Dashboard data collection may not exist:', error);
        }

        // Delete care-plans subcollection
        const carePlansRef = collection(fbdb, 'retirement-homes', homeIdentifier, 'care-plans');
        try {
          const carePlansDocs = await getDocs(carePlansRef);
          for (const docSnapshot of carePlansDocs.docs) {
            await deleteDoc(docSnapshot.ref);
            console.log(`✅ [DELETE API] Deleted Firestore document: care-plans/${docSnapshot.id}`);
          }
        } catch (error) {
          console.log('⚠️ [DELETE API] Care plans collection may not exist:', error);
        }

        // Delete hydration-data subcollection
        const hydrationDataRef = collection(fbdb, 'retirement-homes', homeIdentifier, 'hydration-data');
        try {
          const hydrationDataDocs = await getDocs(hydrationDataRef);
          for (const docSnapshot of hydrationDataDocs.docs) {
            await deleteDoc(docSnapshot.ref);
            console.log(`✅ [DELETE API] Deleted Firestore document: hydration-data/${docSnapshot.id}`);
          }
        } catch (error) {
          console.log('⚠️ [DELETE API] Hydration data collection may not exist:', error);
        }

        // Delete main retirement-homes document
        const homeDocRef = doc(fbdb, 'retirement-homes', homeIdentifier);
        try {
          await deleteDoc(homeDocRef);
          console.log(`✅ [DELETE API] Deleted Firestore document: retirement-homes/${homeIdentifier}`);
        } catch (error) {
          console.log('⚠️ [DELETE API] Main retirement home document may not exist:', error);
        }

        console.log('✅ [DELETE API] Firestore deletion completed');
      } catch (error) {
        console.log('⚠️ [DELETE API] Error deleting Firestore data:', error);
      }
    } else {
      console.log('⚠️ [DELETE API] Firestore not available');
    }

    // Delete local file system directory
    const homeDir = join(process.cwd(), 'data', retirementHome);
    console.log(`🏠 [DELETE API] Deleting local directory: ${homeDir}`);
    
    try {
      await rm(homeDir, { recursive: true, force: true });
      console.log('✅ [DELETE API] Local directory deleted successfully');
    } catch (error) {
      console.log('⚠️ [DELETE API] Local directory may not exist or already deleted:', error);
    }

    console.log('🎉 [DELETE API] Home data deletion completed successfully');

    return NextResponse.json({
      success: true,
      message: `All data for ${retirementHome} has been deleted successfully`
    });

  } catch (error) {
    console.error('💥 [DELETE API] Error deleting home data:', error);
    return NextResponse.json(
      { error: 'Failed to delete home data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
