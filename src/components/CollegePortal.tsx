/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  GraduationCap, Award, MapPin, Phone, Mail, Building2, 
  Calendar, Users, BookOpen, Clock, ShieldCheck, ArrowRight, Server, Globe
} from 'lucide-react';
import { Department, Faculty, PortalItem } from '../types';
import { AttributionMark } from './attribution/AttributionMark';
import { useAttribution } from './attribution/useAttribution';

interface CollegePortalProps {
  departments: Department[];
  faculty: Faculty[];
  portalItems: PortalItem[];
  onOpenAdmin?: () => void;
}

export default function CollegePortal({ departments, faculty, portalItems, onOpenAdmin }: CollegePortalProps) {
  const principal = faculty.find(f => typeof f.designation === 'string' && /Principal/i.test(f.designation));
  const { attribution, isVerified } = useAttribution();

  return (
    <div className="w-full bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      {/* 1. Top Navbar branding with Professional Polish */}
      <header className="bg-slate-900 text-white py-3.5 px-6 md:px-12 flex justify-between items-center shadow-sm border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            N
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold leading-tight tracking-wider text-white uppercase">
              Narayana Engineering College
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 font-medium">Nellore, Andhra Pradesh | Approved by AICTE & Accredited by NAAC</p>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <a href="#about" className="hover:text-white transition-colors">About Us</a>
          <a href="#departments" className="hover:text-white transition-colors">Departments</a>
          <a href="#faculty" className="hover:text-white transition-colors">Faculty</a>
          <a href="#resources" className="hover:text-white transition-colors">Resources</a>
          <a href="#contact" className="hover:text-white transition-colors">Contact</a>
        </nav>
      </header>

      {/* 2. College Announcements Ticker with Professional Slate Style */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2.5 px-6 flex items-center overflow-hidden font-semibold border-b border-slate-800">
        <span className="bg-blue-600/20 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded text-[10px] mr-3 uppercase font-bold flex-shrink-0 animate-pulse">
          Latest Notice
        </span>
        <div className="animate-marquee whitespace-nowrap overflow-x-auto text-slate-300 font-medium tracking-tight">
          AP EAPCET 2026 Admissions Counselling process is active. Check our Admissions section or speak with our virtual smart chatbot below to query procedures, eligibility, and hostel fee details!
        </div>
      </div>

      {/* 3. Hero section using Professional Slate theme */}
      <section id="about" className="relative py-16 md:py-24 px-6 md:px-12 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white text-center flex flex-col items-center justify-center overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-4xl space-y-6 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-blue-400 text-xs font-bold tracking-wider uppercase border border-slate-700">
            <Award className="w-4 h-4 text-blue-500" />
            Accredited by NAAC with 'A' Grade
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            EMPOWERING EXCELLENCE IN <span className="text-blue-500 bg-clip-text">TECHNICAL EDUCATION</span>
          </h2>
          
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Since 1998, Narayana Engineering College, Nellore has stood as a beacon of academic brilliance, research, and robust professional placement drives.
          </p>

          <div className="pt-4 flex flex-wrap gap-4 justify-center">
            <a 
              href="#departments" 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              Explore Departments
              <ArrowRight className="w-4 h-4" />
            </a>
            <button 
              onClick={() => {
                const widgetBtn = document.getElementById('chatbot-floating-toggle-btn');
                if (widgetBtn) widgetBtn.click();
              }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold text-sm rounded-xl border border-slate-700 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              Consult Virtual Advisor
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. College Statistics Panel & Resources */}
      <section className="bg-slate-100/50 border-b border-slate-200/60 py-10 px-6 md:px-12">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '25+', label: 'Years of Legacy', icon: Clock, color: 'text-blue-500 bg-blue-50 border border-blue-100' },
              { value: '85%+', label: 'Placement Record', icon: Award, color: 'text-emerald-500 bg-emerald-50 border border-emerald-100' },
              { value: '150+', label: 'Distinguished Faculty', icon: Users, color: 'text-indigo-500 bg-indigo-50 border border-indigo-100' },
              { value: '45k+', label: 'Library Volumes', icon: BookOpen, color: 'text-amber-500 bg-amber-50 border border-amber-100' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-mono text-xl font-bold text-slate-900 leading-none">{stat.value}</div>
                  <div className="text-xs text-slate-400 font-semibold mt-1.5">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Portal Links */}
          <div id="resources" className="bg-white p-6 rounded-xl border border-slate-200/60 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Campus Resources & Portal Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {portalItems.map((item) => {
                const targetUrl = item.url || item.link || '#';
                const formattedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
                
                return (
                  <a 
                    key={item.id} 
                    href={formattedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block bg-slate-50 hover:bg-blue-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group"
                    onClick={(e) => {
                      if (formattedUrl === 'https://#') {
                        e.preventDefault();
                        return;
                      }
                    }}
                  >
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 group-hover:text-blue-600">
                      <Globe className="w-4 h-4 text-blue-500" />
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Principal message card */}
      {principal && (
        <section className="py-14 px-6 md:px-12 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-200/60">
          <div className="bg-slate-900 border border-slate-800 text-white p-8 rounded-2xl md:col-span-1 shadow-lg space-y-4 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-2xl mx-auto border border-slate-700 shadow-inner">
              {principal.name.replace(/^Dr\s*\.\s*/i, '').split(/[\s\.]+/).filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-base">{principal.name}</h3>
              <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mt-0.5">{principal.designation || 'Designation Not Available'}</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "We aim to produce highly qualified engineers with rigorous analytical thinking and sound ethics to meet global industrial demands."
            </p>
            <div className="pt-2 text-xs font-mono text-slate-500">
              <div className="flex justify-center items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{principal.email}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-5">
            <div className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4.5 h-4.5" />
              Principal's Welcome Note
            </div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              Shaping Future Leaders with Technological Innovations
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              At Narayana Engineering College, Nellore, we foster a rich culture of learning, practical labs, and dynamic academic standards. Our curriculum complies with the highest standards set by AICTE and JNTUA, offering undergraduate students modern laboratories, student clubs, and premium campus facilities.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              Whether you are an aspiring student, a proud alumnus, or a parent, our administration maintains an open door policy. Explore our resources, review our placements, or ask our Virtual AI Chatbot for quick answers about specific procedures.
            </p>
          </div>
        </section>
      )}

      {/* 6. College Departments & HOD Panel */}
      <section id="departments" className="py-16 px-6 md:px-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-widest border border-blue-100">
              Academic Excellence
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Our Departments & Leadership</h3>
            <p className="text-slate-500 text-sm">Explore our diverse academic departments and connect with the dedicated heads leading our scholarly initiatives.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {departments.filter(d => d.id !== 'ADMIN' && d.id !== 'ADMISSIONS').map((dept) => {
              const hod = faculty.find(f => f.department === dept.name && typeof f.designation === 'string' && /HOD|Head of Department|Head/i.test(f.designation));
              return (
                <div key={dept.id} className="group bg-slate-50 p-7 rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-blue-200 shadow-lg">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">
                        {dept.id}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-lg leading-snug">{dept.name}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        {dept.location}
                      </p>
                    </div>
                  </div>

                  {hod && (
                    <div className="mt-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-inner space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                          {hod.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{hod.name}</div>
                          <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wide">{hod.designation || 'Head of Department'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-500 pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{hod.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dept.contactNumber}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Footer Contact section with Sleek Slate Finish */}
      <footer id="contact" className="bg-slate-950 text-white pt-14 pb-8 px-6 md:px-12 mt-auto border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-10 border-b border-slate-900">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                N
              </div>
              <h4 className="font-bold tracking-wider text-white uppercase text-sm leading-tight">
                Narayana Engineering College
              </h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Serving premium education for more than two decades, producing brilliant engineers ready to resolve challenging industrial problems worldwide.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Campus Location</h4>
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>Haranathapuram, Nellore, Andhra Pradesh, India - 524004.</span>
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-[10px] uppercase tracking-widest text-slate-500">General Helpdesk</h4>
            <div className="text-xs text-slate-400 space-y-1.5">
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500" />
                <span>+91-861-2313869 / +91-9440231386</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                <span>info@necn.ac.in / principal@necn.ac.in</span>
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-900/80 flex flex-col sm:flex-row justify-between items-center text-slate-500 text-xs gap-4">
          <div>
            <p>© 2026 Narayana Engineering College, Nellore. All rights reserved.</p>
            {isVerified && (
              <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
                <span>Crafted & Engineered by</span>
                <AttributionMark variant="footer" />
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 font-semibold text-slate-400">
            <span className="font-mono text-[10px] bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-slate-400">
              {isVerified && attribution
                ? `NEXA AI Engine • Developed by ${attribution.displayName || attribution.name} (${attribution.rollNo})`
                : 'NEXA AI Engine • Narayana Engineering College, Nellore'}
            </span>
          </div>
        </div>
      </footer>

      {/* Floating Watermark Pill */}
      <AttributionMark variant="floating" />
    </div>
  );
}
