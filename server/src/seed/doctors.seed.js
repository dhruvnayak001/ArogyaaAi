/**
 * seed/doctors.seed.js
 *
 * Seeds 8 demo doctor accounts for ArogyaAI hackathon demo.
 * Run with: node server/src/seed/doctors.seed.js
 *
 * Each doctor gets:
 *  - Role: 'doctor'
 *  - Full doctorProfile with specialization, experience, fee, rating, languages
 *  - Availability schedule (Mon–Fri, 09:00–17:00)
 *  - isEmailVerified: true (skip OTP for demo)
 *
 * Password for all seed doctors: Doctor@123456
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

const DEMO_DOCTORS = [
  {
    name: 'Dr. Ankita Sangwikar',
    email: 'd2317075@gmail.com',
    doctorProfile: {
      specialization: 'General Physician',
      qualifications: ['MBBS', 'MD - General Medicine'],
      experience: 14,
      licenseNumber: 'MH-GP-10042',
      hospital: 'Apollo Hospitals, Mumbai',
      consultationFee: 600,
      bio: 'Experienced General Physician with focus on preventive care and chronic disease management.',
      rating: 4.7,
      reviewCount: 312,
      isVerified: true,
      languages: ['English', 'Hindi', 'Marathi'],
      availability: {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30,
      },
    },
  },
  {
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta@arogyaai.demo',
    doctorProfile: {
      specialization: 'Cardiologist',
      qualifications: ['MBBS', 'MD - Cardiology', 'DM - Cardiology'],
      experience: 11,
      licenseNumber: 'MH-CAR-20187',
      hospital: 'Fortis Hospital, Pune',
      consultationFee: 1200,
      bio: 'Senior Cardiologist specializing in non-invasive cardiac diagnostics and heart failure management.',
      rating: 4.9,
      reviewCount: 187,
      isVerified: true,
      languages: ['English', 'Hindi', 'Gujarati'],
      availability: {
        days: ['Mon', 'Tue', 'Thu', 'Fri'],
        startTime: '10:00',
        endTime: '16:00',
        slotDuration: 30,
      },
    },
  },
  {
    name: 'Dr. Anil Deshmukh',
    email: 'anil.deshmukh@arogyaai.demo',
    doctorProfile: {
      specialization: 'Neurologist',
      qualifications: ['MBBS', 'MD - Neurology', 'DM - Neurology'],
      experience: 18,
      licenseNumber: 'MH-NEU-30091',
      hospital: 'Kokilaben Hospital, Mumbai',
      consultationFee: 1500,
      bio: 'Neurologist with expertise in epilepsy, stroke rehabilitation and headache disorders.',
      rating: 4.8,
      reviewCount: 224,
      isVerified: true,
      languages: ['English', 'Hindi', 'Marathi'],
      availability: {
        days: ['Tue', 'Wed', 'Thu', 'Sat'],
        startTime: '09:00',
        endTime: '15:00',
        slotDuration: 45,
      },
    },
  },
  {
    name: 'Dr. Sneha Kulkarni',
    email: 'sneha.kulkarni@arogyaai.demo',
    doctorProfile: {
      specialization: 'Dermatologist',
      qualifications: ['MBBS', 'MD - Dermatology'],
      experience: 8,
      licenseNumber: 'MH-DER-40233',
      hospital: 'Lilavati Hospital, Mumbai',
      consultationFee: 800,
      bio: 'Dermatologist specializing in acne, eczema, psoriasis, and cosmetic dermatology.',
      rating: 4.6,
      reviewCount: 445,
      isVerified: true,
      languages: ['English', 'Marathi', 'Hindi'],
      availability: {
        days: ['Mon', 'Wed', 'Fri', 'Sat'],
        startTime: '11:00',
        endTime: '18:00',
        slotDuration: 30,
      },
    },
  },
  {
    name: 'Dr. Vikram Patel',
    email: 'vikram.patel@arogyaai.demo',
    doctorProfile: {
      specialization: 'Orthopedist',
      qualifications: ['MBBS', 'MS - Orthopedics'],
      experience: 15,
      licenseNumber: 'MH-ORT-50128',
      hospital: 'Jupiter Hospital, Thane',
      consultationFee: 1000,
      bio: 'Orthopedic surgeon with expertise in joint replacement, sports injuries and spine disorders.',
      rating: 4.7,
      reviewCount: 289,
      isVerified: true,
      languages: ['English', 'Hindi', 'Gujarati'],
      availability: {
        days: ['Mon', 'Tue', 'Thu', 'Fri'],
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30,
      },
    },
  },
  {
    name: 'Dr. Anjali Nair',
    email: 'anjali.nair@arogyaai.demo',
    doctorProfile: {
      specialization: 'Gynecologist',
      qualifications: ['MBBS', 'MS - Gynecology & Obstetrics'],
      experience: 12,
      licenseNumber: 'MH-GYN-60044',
      hospital: 'Motherhood Hospital, Pune',
      consultationFee: 900,
      bio: 'Gynecologist specializing in high-risk pregnancies, PCOS, and minimally invasive gynecological procedures.',
      rating: 4.9,
      reviewCount: 512,
      isVerified: true,
      languages: ['English', 'Malayalam', 'Hindi'],
      availability: {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        startTime: '09:00',
        endTime: '16:00',
        slotDuration: 30,
      },
    },
  },
  {
    name: 'Dr. Suresh Iyer',
    email: 'suresh.iyer@arogyaai.demo',
    doctorProfile: {
      specialization: 'Paediatrician',
      qualifications: ['MBBS', 'MD - Paediatrics'],
      experience: 10,
      licenseNumber: 'MH-PED-70312',
      hospital: 'Cloudnine Hospital, Mumbai',
      consultationFee: 700,
      bio: 'Child specialist with focus on newborn care, growth development, and pediatric infectious diseases.',
      rating: 4.8,
      reviewCount: 378,
      isVerified: true,
      languages: ['English', 'Tamil', 'Hindi'],
      availability: {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        startTime: '10:00',
        endTime: '17:00',
        slotDuration: 20,
      },
    },
  },
  {
    name: 'Dr. Meera Joshi',
    email: 'meera.joshi@arogyaai.demo',
    doctorProfile: {
      specialization: 'Psychiatrist',
      qualifications: ['MBBS', 'MD - Psychiatry'],
      experience: 9,
      licenseNumber: 'MH-PSY-80195',
      hospital: 'NIMHANS Affiliated Clinic, Nagpur',
      consultationFee: 1100,
      bio: 'Psychiatrist specializing in anxiety disorders, depression, and cognitive behavioral therapy.',
      rating: 4.8,
      reviewCount: 203,
      isVerified: true,
      languages: ['English', 'Hindi', 'Marathi'],
      availability: {
        days: ['Mon', 'Wed', 'Thu', 'Fri'],
        startTime: '12:00',
        endTime: '19:00',
        slotDuration: 45,
      },
    },
  },
];

async function seedDoctors() {
  await connectDB();

  const User = require('../models/User.model');
  const hashedPassword = await bcrypt.hash('Doctor@123456', 12);

  let created = 0;
  let skipped = 0;

  for (const doc of DEMO_DOCTORS) {
    const exists = await User.findOne({ email: doc.email });
    if (exists) {
      console.log(`⏭️  Skipping ${doc.name} — already exists`);
      skipped++;
      continue;
    }

    await User.create({
      ...doc,
      password: hashedPassword,
      role: 'doctor',
      isEmailVerified: true,
      isActive: true,
      phone: '+91 98' + String(Math.floor(Math.random() * 90000000) + 10000000),
    });

    console.log(`✅ Created ${doc.name} (${doc.doctorProfile.specialization})`);
    created++;
  }

  console.log(`\n🌱 Seed complete: ${created} created, ${skipped} skipped`);
  process.exit(0);
}

seedDoctors().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
