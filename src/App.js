import React, { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB0QRqHtVnGB1gbZ-wmp8pdDtO4H4W9gHI",
  authDomain: "plus-ou-moins-607e8.firebaseapp.com",
  projectId: "plus-ou-moins-607e8",
  storageBucket: "plus-ou-moins-607e8.appspot.com",
  messagingSenderId: "889520067973",
  appId: "1:889520067973:web:1fc71089d9c2b3843860ec",
  measurementId: "G-WCDSCTRJQW",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [nom, setNom] = useState("");
  const [joueurs, setJoueurs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [actions, setActions] = useState([]);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const connecterAvecGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      console.error("Erreur connexion :", error);
    }
  };

  const deconnexion = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Erreur déconnexion :", error);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "scores"), (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setJoueurs(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "chat"),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => msgs.push(doc.data()));
      setMessages(msgs.reverse());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "actions"),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = [];
      snapshot.forEach((doc) => logs.push(doc.data()));
      setActions(logs);
    });
    return () => unsub();
  }, []);

  const ajouterJoueur = async () => {
    const nomTrim = nom.trim();
    if (!nomTrim || !user) return;
    const ref = doc(db, "scores", nomTrim.toLowerCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { nom: nomTrim, score: 0 });
    setNom("");
  };

  const verifierClicks = () => {
    const key = `clicks_${user.uid}`;
    const heure = new Date().getHours();
    const last = localStorage.getItem(`${key}_heure`);
    if (last !== String(heure)) {
      localStorage.setItem(`${key}_heure`, String(heure));
      localStorage.setItem(key, "1");
      setClicks(1);
      return true;
    }
    let count = parseInt(localStorage.getItem(key) || "0", 10);
    if (count >= 100) return false;
    count++;
    localStorage.setItem(key, String(count));
    setClicks(count);
    return true;
  };

  const modifierScore = async (id, delta) => {
    if (!user || !verifierClicks()) return;
    const ref = doc(db, "scores", id);
    await updateDoc(ref, { score: increment(delta) });
    await addDoc(collection(db, "actions"), {
      auteur: user.displayName,
      cible: id,
      valeur: delta,
      timestamp: serverTimestamp(),
    });
  };

  const envoyerMessage = async () => {
    if (!message.trim() || !user) return;
    await addDoc(collection(db, "chat"), {
      user: user.displayName,
      texte: message.trim(),
      timestamp: serverTimestamp(),
    });
    setMessage("");
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}> Plus ou Moins mes singes ? 🐒✡️</h1>

      {!user ? (
        <div style={styles.centered}>
          <p>🔐 Tu vas gentiment commencer par te connecter</p>
          <button style={styles.button} onClick={connecterAvecGoogle}>
            Connexion Google
          </button>
        </div>
      ) : (
        <div style={styles.authenticated}>
          <div style={styles.userInfo}>
            <span>👋 Salut {user.displayName} !</span>
            <button style={styles.linkButton} onClick={deconnexion}>
              Déconnexion
            </button>
          </div>

          <div style={styles.inputRow}>
            <input
              type="text"
              placeholder="Ton pseudo"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              style={styles.input}
            />
            <button onClick={ajouterJoueur} style={styles.button}>
              Rejoindre
            </button>
          </div>
        </div>
      )}

      <div style={styles.scoreContainer}>
        {joueurs.length > 0 ? (
          joueurs.map((j) => (
            <div key={j.id} style={styles.scoreItem}>
              <span style={styles.nom}>{j.nom}</span>
              <span style={styles.score}>{j.score}</span>
              {user && (
                <div style={styles.btnGroup}>
                  <button
                    onClick={() => modifierScore(j.id, 1)}
                    style={styles.scoreBtn}
                  >
                    +1
                  </button>
                  <button
                    onClick={() => modifierScore(j.id, -1)}
                    style={styles.scoreBtn}
                  >
                    -1
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p>
            Si t'es le premier à voir ce message, tu peux distribuer une gorgée
            🍻
          </p>
        )}
      </div>

      <div style={styles.section}>
        <h3>💬 Chat de partie</h3>
        <div style={styles.chatBox}>
          {messages.map((m, idx) => (
            <p key={idx}>
              <strong>{m.user}</strong> : {m.texte}
            </p>
          ))}
        </div>
        <div style={styles.inputRow}>
          <input
            placeholder="Un message ?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={styles.input}
          />
          <button onClick={envoyerMessage} style={styles.button}>
            Envoyer
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h3>📣 Activité récente</h3>
        <ul>
          {actions.map((a, i) => (
            <li key={i} style={{ color: a.valeur < 0 ? "red" : "green" }}>
              {a.auteur} {a.valeur > 0 ? "a ajouté" : "a retiré"}{" "}
              {Math.abs(a.valeur)} point{Math.abs(a.valeur) > 1 ? "s" : ""} à{" "}
              {a.cible} 💥
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 20,
    fontFamily: "'Segoe UI', sans-serif",
    maxWidth: 500,
    margin: "0 auto",
  },
  title: {
    textAlign: "center",
    fontSize: "2rem",
    marginBottom: 20,
  },
  centered: {
    textAlign: "center",
  },
  authenticated: {
    marginBottom: 30,
  },
  userInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    fontSize: "1rem",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  button: {
    backgroundColor: "#4CAF50",
    color: "white",
    padding: "10px 16px",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#007BFF",
    cursor: "pointer",
    fontSize: 14,
  },
  scoreContainer: {
    marginTop: 20,
  },
  scoreItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#f9f9f9",
    padding: "10px 15px",
    marginBottom: 10,
    borderRadius: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  },
  nom: {
    fontWeight: "bold",
    fontSize: 16,
    flex: 1,
  },
  score: {
    fontSize: 16,
    marginRight: 10,
  },
  btnGroup: {
    display: "flex",
    gap: 5,
  },
  scoreBtn: {
    fontSize: 14,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    cursor: "pointer",
  },
  section: {
    marginTop: 30,
  },
  chatBox: {
    maxHeight: 150,
    overflowY: "auto",
    padding: 10,
    background: "#eee",
    borderRadius: 8,
    marginBottom: 10,
  },
};
