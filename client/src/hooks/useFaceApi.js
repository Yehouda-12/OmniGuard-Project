import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// הגדרת הנתיב (URL) שממנו יטענו המודלים של זיהוי הפנים.
// המודלים מאוחסנים בשרת CDN כדי להבטיח טעינה מהירה וזמינות.
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';

/**
 * Hook מותאם אישית לטעינה וניהול של מודלי face-api.js.
 * Hook זה דואג לטעון את המודלים הנדרשים פעם אחת בלבד כשהאפליקציה עולה,
 * ומספק מידע על מצב הטעינה, ההתקדמות, והאם התרחשה שגיאה.
 * זה מאפשר לקומפוננטות אחרות לדעת מתי "המוח" של הבינה המלאכותית מוכן לפעולה.
 */
const useFaceApi = () => {
  // ניהול מצב הטעינה באמצעות אובייקט אחד. זה מבטיח עדכונים אטומיים ומונע מצבי ביניים לא רצויים.
  const [loadingState, setLoadingState] = useState({
    ready: false,    // האם כל המודלים נטענו ומוכנים לשימוש?
    progress: 0,     // התקדמות הטעינה באחוזים (0-100).
    error: null,     // הודעת שגיאה אם הטעינה נכשלה.
  });

  // useEffect משמש להרצת קוד צד-שלישי (side effect) לאחר רינדור הקומפוננטה.
  // שימוש במערך תלויות ריק [] מבטיח שהקוד ירוץ פעם אחת בלבד, בדומה ל-componentDidMount בקלאסים.
  useEffect(() => {
    // פונקציה אסינכרונית פנימית לביצוע טעינת המודלים.
    const loadModels = async () => {
      try {
        // טעינת המודלים מתבצעת באופן סדרתי כדי שנוכל לעקוב אחר ההתקדמות.
        // Promise.all משמש כאן כדי להבטיח שכל המודלים יטענו.
        await Promise.all([
          // 1. טעינת המודל לזיהוי פנים: TinyFaceDetector
          //    זהו מודל קטן ומהיר לזיהוי מסגרות-תיחום (bounding boxes) של פנים בתמונה.
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),

          // 2. טעינת המודל לזיהוי נקודות ציון על הפנים: FaceLandmark68Net
          //    מודל זה מזהה 68 נקודות מפתח על הפנים (עיניים, גבות, פה, אף, קו לסת).
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),

          // 3. טעינת המודל לזיהוי והשוואת פנים: FaceRecognitionNet
          //    מודל זה מייצר "וקטור תכונות" (descriptor) ייחודי לפנים המזוהות,
          //    שמאפשר להשוות אותן לפנים אחרות ולזהות אנשים.
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        // לאחר שכל המודלים נטענו בהצלחה, מעדכנים את המצב ל'מוכן'.
        setLoadingState({ ready: true, progress: 100, error: null });
      } catch (err) {
        // במקרה של שגיאה במהלך הטעינה, נעדכן את מצב השגיאה ונציג הודעה בקונסול.
        setLoadingState({
          ready: false,
          progress: 0,
          error: 'Failed to load face-api models.',
        });
        console.error('Error loading face-api models:', err);
      }
    };

    loadModels();
  }, []);

  // החזרת אובייקט המצב כדי שקומפוננטות אחרות יוכלו להשתמש בו.
  return loadingState;
};

export default useFaceApi;