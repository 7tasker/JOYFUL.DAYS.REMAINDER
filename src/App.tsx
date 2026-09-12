import React, { useState, useEffect } from 'react';
import { AdminUser, ActiveModule, DatabaseBackup } from './types';
import { StorageService } from './services/storageService';
import { AdminSessionService } from './services/adminSessionService';
import { AdminAuthGate } from './components/auth/AdminAuthGate';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewDashboard } from './components/modules/OverviewDashboard';
import { GatewaysModule } from './components/modules/GatewaysModule';
import { AdMobModule } from './components/modules/AdMobModule';
import { CelebrationsModule } from './components/modules/CelebrationsModule';
import { BackupsModule } from './components/modules/BackupsModule';
import { FinancialsModule } from './components/modules/FinancialsModule';
import { UserReviewsModule } from './components/modules/UserReviewsModule';
import { BackupTriggerModal } from './components/modals/BackupTriggerModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';

export default function App() {
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    // Only load admin user if an active, non-expired session exists
    if (!StorageService.isSessionValid()) return null;
    const user = StorageService.getAdminUser();
    return user && StorageService.isAuthorizedAdmin(user.email) ? user : null;
  });

  const [activeModule, setActiveModule] = useState<ActiveModule>('overview');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [globalBannerMsg, setGlobalBannerMsg] = useState<string | null>(null);

  // Monitor session expiration events from all services & API interceptors
  useEffect(() => {
    const unsub = AdminSessionService.onSessionExpired((msg) => {
      setSessionExpiredNotice(msg);
      setCurrentUser(null);
    });
    return () => unsub();
  }, []);

  // Periodic heartbeat: enforce expiration if token passes TTL while browser tab remains open
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (!AdminSessionService.isSessionValid()) {
        AdminSessionService.clearSession();
        setSessionExpiredNotice('Your admin session has expired. Please sign in again.');
        setCurrentUser(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Global ⌘K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAuthenticated = (user: AdminUser) => {
    setSessionExpiredNotice(null);
    setCurrentUser(user);
    setActiveModule('overview');
  };

  const handleLogout = () => {
    StorageService.addAuditLog({
      actor: currentUser?.email || 'admin@7tasker.com',
      action: 'ADMIN_SESSION_TERMINATED',
      module: 'Security',
      severity: 'info',
      details: 'Super administrator manually terminated session.',
    });
    AdminSessionService.clearSession();
    setCurrentUser(null);
  };

  const handleLockSession = () => {
    StorageService.addAuditLog({
      actor: currentUser?.email || 'admin@7tasker.com',
      action: 'ADMIN_SESSION_LOCKED',
      module: 'Security',
      severity: 'info',
      details: 'Session locked by admin for zero-trust re-authentication.',
    });
    AdminSessionService.clearSession();
    setCurrentUser(null);
  };

  const handleBackupSuccess = (bkp: DatabaseBackup) => {
    setGlobalBannerMsg(`Point-in-time database snapshot created: ${bkp.fileName} (${bkp.fileSizeMb} MB)`);
    setTimeout(() => setGlobalBannerMsg(null), 5000);
  };

  return (
    <AdminAuthGate
      currentUser={currentUser}
      sessionExpiredNotice={sessionExpiredNotice}
      onAuthenticated={handleAuthenticated}
    >
      {currentUser && (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
          {/* Global System Navbar */}
          <Navbar
            adminUser={currentUser}
            activeModule={activeModule}
            onSelectModule={setActiveModule}
            onLogout={handleLogout}
            onLockSession={handleLockSession}
            onOpenSearch={() => setIsSearchModalOpen(true)}
          />

          {/* Global System Toast/Banner */}
          {globalBannerMsg && (
            <div className="sticky top-16 z-30 bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white flex items-center justify-between shadow-lg">
              <span>{globalBannerMsg}</span>
              <button
                type="button"
                onClick={() => setGlobalBannerMsg(null)}
                className="text-white/80 hover:text-white ml-4 text-sm"
              >
                ✕
              </button>
            </div>
          )}

          {/* Main App Layout */}
          <div className="flex-1 flex">
            {/* Sidebar Navigation */}
            <div className="hidden md:block">
              <Sidebar
                activeModule={activeModule}
                onSelectModule={setActiveModule}
                onQuickBackup={() => setIsBackupModalOpen(true)}
              />
            </div>

            {/* Dynamic Module Content View */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
              {activeModule === 'overview' && (
                <OverviewDashboard
                  onSelectModule={setActiveModule}
                  onTriggerBackupModal={() => setIsBackupModalOpen(true)}
                />
              )}

              {activeModule === 'gateways' && <GatewaysModule />}

              {activeModule === 'admob' && <AdMobModule />}

              {activeModule === 'celebrations' && <CelebrationsModule />}

              {activeModule === 'backups' && <BackupsModule />}

              {activeModule === 'financials' && <FinancialsModule />}

              {activeModule === 'reviews' && <UserReviewsModule />}
            </main>
          </div>

          {/* Global Modals */}
          <BackupTriggerModal
            isOpen={isBackupModalOpen}
            onClose={() => setIsBackupModalOpen(false)}
            onSuccess={handleBackupSuccess}
          />

          <GlobalSearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            onSelectModule={setActiveModule}
          />
        </div>
      )}
    </AdminAuthGate>
  );
}
