"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Consultation, Patient, Recording } from "./types";

// Records live in the doctor's own browser (IndexedDB). Nothing is stored on
// the server, which suits a free Vercel/Render deploy and keeps patient data
// on the device. Swap this module for Supabase later without touching pages.

interface YaadDB extends DBSchema {
  patients: { key: string; value: Patient };
  consultations: {
    key: string;
    value: Consultation;
    indexes: { byPatient: string };
  };
  // Audio is kept apart from consultations so listing visits never loads blobs.
  recordings: { key: string; value: Recording };
}

let dbPromise: Promise<IDBPDatabase<YaadDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<YaadDB>("yaad", 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore("patients", { keyPath: "id" });
          const c = database.createObjectStore("consultations", { keyPath: "id" });
          c.createIndex("byPatient", "patientId");
        }
        if (oldVersion < 2) database.createObjectStore("recordings", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export function newId() {
  return crypto.randomUUID();
}

export async function savePatient(p: Patient) {
  await (await db()).put("patients", p);
}

export async function getPatient(id: string) {
  return (await db()).get("patients", id);
}

export async function listPatients() {
  const all = await (await db()).getAll("patients");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function findPatient(name: string, phone: string) {
  const all = await (await db()).getAll("patients");
  const n = name.trim().toLowerCase();
  return all.find(
    (p) => p.name.trim().toLowerCase() === n && (!phone || !p.phone || p.phone === phone),
  );
}

export async function saveConsultation(c: Consultation) {
  await (await db()).put("consultations", c);
}

export async function getConsultation(id: string) {
  return (await db()).get("consultations", id);
}

export async function listConsultations(patientId?: string) {
  const d = await db();
  const all = patientId
    ? await d.getAllFromIndex("consultations", "byPatient", patientId)
    : await d.getAll("consultations");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteConsultation(id: string) {
  const d = await db();
  await d.delete("recordings", id);
  await d.delete("consultations", id);
}

export async function saveRecording(r: Recording) {
  await (await db()).put("recordings", r);
  // Ask the browser not to evict our data under storage pressure. Best effort.
  navigator.storage?.persist?.().catch(() => {});
}

export async function getRecording(id: string) {
  return (await db()).get("recordings", id);
}

export async function deleteRecording(id: string) {
  await (await db()).delete("recordings", id);
}
