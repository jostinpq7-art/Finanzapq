import { db, isMock } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Transaction, TransactionStatus } from '../types';

const COLLECTION_NAME = 'transactions';
const STORAGE_KEY = 'demo_glass_transactions';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
  if (isMock) {
    await delay(600); 
    const rawData = localStorage.getItem(STORAGE_KEY);
    const transactions = rawData ? JSON.parse(rawData) : [];
    
    const newDoc = {
      ...transaction,
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    transactions.push(newDoc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return newDoc.id;
  }

  try {
    if (!db) throw new Error("Database not initialized");
    const docRef = await addDoc(collection(db, COLLECTION_NAME), transaction);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const updateTransactionStatus = async (transactionId: string, status: TransactionStatus) => {
  if (isMock) {
    await delay(300);
    const rawData = localStorage.getItem(STORAGE_KEY);
    let transactions: Transaction[] = rawData ? JSON.parse(rawData) : [];
    
    transactions = transactions.map(t => 
      t.id === transactionId ? { ...t, status } : t
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return;
  }

  try {
    if (!db) throw new Error("Database not initialized");
    const docRef = doc(db, COLLECTION_NAME, transactionId);
    await updateDoc(docRef, { status });
  } catch (e) {
    console.error("Error updating document: ", e);
    throw e;
  }
};

export const getUserTransactions = async (userId: string) => {
  if (isMock) {
    await delay(400); 
    const rawData = localStorage.getItem(STORAGE_KEY);
    const transactions: Transaction[] = rawData ? JSON.parse(rawData) : [];
    
    return transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => b.date - a.date);
  }

  try {
    if (!db) throw new Error("Database not initialized");
    const q = query(
      collection(db, COLLECTION_NAME), 
      where("userId", "==", userId),
      orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
  } catch (e) {
    console.error("Error getting documents: ", e);
    return [];
  }
};