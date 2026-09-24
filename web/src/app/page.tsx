'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Simulator } from '@/components/Simulator';
import { CompareView } from '@/components/CompareView';
import { DevnetVerified } from '@/components/DevnetVerified';
import { Findings } from '@/components/Findings';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F3EC] flex flex-col">
      <Navbar />
      <Hero />
      <Simulator />
      <CompareView />
      <DevnetVerified />
      <Findings />
      <Footer />
    </main>
  );
}
