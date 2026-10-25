import type { Metadata } from "next";
import { PatientsList } from "@/components/patients/patients-list";
export const metadata: Metadata = { title: "Pacientes" };
export default function PatientsPage() { return <PatientsList />; }
