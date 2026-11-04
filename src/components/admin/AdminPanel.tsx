import { useEffect, useState } from 'react';
import {
  Settings,
  MapPin,
  Users,
  Clock,
  Save,
  Plus,
  Trash2,
  CreditCard,
  Stethoscope,
  User as UserIcon,
  Shield,
  Navigation,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ClipboardList,
  Loader2,
  X,
  Search,
  FlaskConical,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SedeSelector } from './SedeSelector';
import { TestModeTab } from './TestModeTab';
import { TabStrip } from '../TabStrip';
import type { Role, User as AppUser, SedeConfig } from '../../types';

const DEFAULT_SPECIALTIES = [
  'Médico General',
  'Médico Especialista',
  'Laboratorio - Ejecución',
  'Laboratorio - Entrega de Resultados',
];

interface AdminPanelProps {
  user: AppUser;
}

type Tab = 'sede' | 'staff' | 'params' | 'test';

type ToastType = 'success' | 'error';
interface ToastState {
  message: string;
  type: ToastType;
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const isSuccess = toast.type === 'success';
  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-slide-up"
    >
      <div
        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl ${
          isSuccess
            ? 'bg-emerald-500 text-white'
            : 'bg-red-500 text-white'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <p className="text-sm font-semibold">{toast.message}</p>
        <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function AdminPanel({ user }: AdminPanelProps) {
  const { data, updateSede, addUser, removeUser, resetAll, updateDoctorSpecialty, getSpecialties, addSpecialty, updateSpecialty } = useApp();
  const [tab, setTab] = useState<Tab>('sede');
  const [deleteError, setDeleteError] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSaveSede = async (s: Partial<SedeConfig>) => {
    try {
      await updateSede(s);
      showToast('¡Parámetros de la sede actualizados y guardados en Supabase con éxito!', 'success');
    } catch {
      showToast('Error al guardar los parámetros. Revisa tu conexión e intenta nuevamente.', 'error');
    }
  };

  const handleReset = async () => {
    try {
      await resetAll();
      showToast('Datos del sistema reiniciados correctamente.', 'success');
    } catch {
      showToast('Error al reiniciar los datos. Intenta nuevamente.', 'error');
    }
  };

  const handleRemove = async (cedula: string, name: string) => {
    setDeleteError('');
    const ok = await removeUser(cedula);
    if (!ok) {
      setDeleteError(`No se pudo eliminar a ${name}. Solo el Administrador Global puede eliminar usuarios.`);
      setTimeout(() => setDeleteError(''), 5000);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] px-4 py-5 max-w-md mx-auto">
      {/* Admin header */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-3xl p-5 shadow-lg mb-4 text-white animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-lg font-bold">Panel Administrador</p>
            <p className="text-white/60 text-sm">{user.name} · Configuración global</p>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <TabStrip className="bg-slate-100 rounded-xl p-1 mb-4">
        {[
          { key: 'sede' as Tab, label: 'Sede', icon: MapPin },
          { key: 'staff' as Tab, label: 'Personal', icon: Users },
          { key: 'params' as Tab, label: 'Parámetros', icon: Clock },
          { key: 'test' as Tab, label: 'Prueba Test', icon: FlaskConical },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-white text-blue-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-600'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </TabStrip>

      {deleteError && (
        <div className="mb-4 bg-red-50 rounded-xl p-3 flex items-center gap-2 animate-slide-up">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {tab === 'sede' && <SedeTab sede={data.sede} onSave={handleSaveSede} />}
      {tab === 'staff' && (
        <StaffTab
          users={data.users}
          onAdd={addUser}
          onRemove={handleRemove}
          adminCedula={user.cedula}
          onUpdateSpecialty={updateDoctorSpecialty}
          specialties={getSpecialties()}
          onAddSpecialty={addSpecialty}
          onUpdateSpecialtyName={updateSpecialty}
          onToast={showToast}
        />
      )}
      {tab === 'params' && <ParamsTab sede={data.sede} onSave={handleSaveSede} onReset={handleReset} />}
      {tab === 'test' && <TestModeTab />}
    </div>
  );
}

function SedeTab({
  sede,
  onSave,
}: {
  sede: { name: string; address: string; lat: number; lng: number };
  onSave: (s: Partial<typeof sede>) => void;
}) {
  const [name, setName] = useState(sede.name);
  const [address, setAddress] = useState(sede.address);
  const [lat, setLat] = useState(String(sede.lat));
  const [lng, setLng] = useState(String(sede.lng));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(sede.name);
    setAddress(sede.address);
    setLat(String(sede.lat));
    setLng(String(sede.lng));
  }, [sede.name, sede.address, sede.lat, sede.lng]);

  const handleSave = () => {
    onSave({
      name,
      address,
      lat: parseFloat(lat) || 0,
      lng: parseFloat(lng) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <Settings className="w-5 h-5 text-blue-700" />
        Datos de la Sede
      </h3>

      <SedeSelector activeName={sede.name} onSelect={onSave} />

      <div>
        <label className="text-sm font-medium text-slate-600 mb-1.5 block">
          Nombre de la Clínica/Sede
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200
                     focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                     outline-none transition-all text-slate-800"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-600 mb-1.5 block">
          Dirección
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200
                     focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                     outline-none transition-all text-slate-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Latitud GPS
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200
                       focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                       outline-none transition-all text-slate-800"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Longitud GPS
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200
                       focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                       outline-none transition-all text-slate-800"
          />
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2.5">
        <Navigation className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600">
          Estas coordenadas definen el punto de referencia para el check-in geolocalizado de los pacientes.
        </p>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-blue-700 text-white font-semibold py-3.5 rounded-xl
                   hover:bg-blue-800 active:scale-[0.98] transition-all
                   flex items-center justify-center gap-2"
      >
        {saved ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            ¡Guardado!
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Guardar cambios
          </>
        )}
      </button>
    </div>
  );
}

function StaffTab({
  users,
  onAdd,
  onRemove,
  adminCedula,
  onUpdateSpecialty,
  specialties,
  onAddSpecialty,
  onUpdateSpecialtyName,
  onToast,
}: {
  users: AppUser[];
  onAdd: (u: AppUser) => void;
  onRemove: (cedula: string, name: string) => void;
  adminCedula: string;
  onUpdateSpecialty: (cedula: string, specialty: string) => Promise<void>;
  specialties: { id: string; name: string }[];
  onAddSpecialty: (name: string) => Promise<{ id: string; name: string } | null>;
  onUpdateSpecialtyName: (id: string, name: string) => Promise<{ id: string; name: string } | null>;
  onToast: (message: string, type: ToastType) => void;
}) {
  const allSpecialties = specialties.length > 0 ? specialties.map((s) => s.name) : DEFAULT_SPECIALTIES;
  const [newName, setNewName] = useState('');
  const [newCedula, setNewCedula] = useState('');
  const [newRole, setNewRole] = useState<Role>('doctor');
  const [newSpecialty, setNewSpecialty] = useState<string>(allSpecialties[0]);
  const [error, setError] = useState('');
  const [editingSpecialtyFor, setEditingSpecialtyFor] = useState<string | null>(null);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [showNewSpecialtyInput, setShowNewSpecialtyInput] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [addingSpecialty, setAddingSpecialty] = useState(false);

  // Inline specialty name editing state
  const [editingSpecialtyId, setEditingSpecialtyId] = useState<string | null>(null);
  const [editingSpecialtyName, setEditingSpecialtyName] = useState('');
  const [savingSpecialtyName, setSavingSpecialtyName] = useState(false);

  // Role sub-tabs + search
  type RoleTab = 'patient' | 'doctor' | 'secretary' | 'admin';
  const [roleTab, setRoleTab] = useState<RoleTab>('patient');
  const [searchQuery, setSearchQuery] = useState('');

  const startEditingSpecialty = (spec: { id: string; name: string }) => {
    setEditingSpecialtyId(spec.id);
    setEditingSpecialtyName(spec.name);
  };

  const cancelEditingSpecialty = () => {
    setEditingSpecialtyId(null);
    setEditingSpecialtyName('');
  };

  const handleSaveSpecialtyName = async () => {
    if (!editingSpecialtyId) return;
    const trimmed = editingSpecialtyName.trim();
    if (!trimmed) {
      onToast('El nombre de la especialidad no puede estar vacío.', 'error');
      return;
    }
    setSavingSpecialtyName(true);
    const original = specialties.find((s) => s.id === editingSpecialtyId);
    if (original && original.name === trimmed) {
      cancelEditingSpecialty();
      setSavingSpecialtyName(false);
      return;
    }
    const result = await onUpdateSpecialtyName(editingSpecialtyId, trimmed);
    setSavingSpecialtyName(false);
    if (result) {
      cancelEditingSpecialty();
      onToast('Especialidad actualizada correctamente.', 'success');
    } else {
      onToast('No se pudo actualizar. Ya existe una especialidad con ese nombre o hubo un error.', 'error');
    }
  };

  const handleSpecialtyNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveSpecialtyName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingSpecialty();
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCedula.trim()) {
      setError('Completa nombre y documento de identificación.');
      return;
    }
    if (users.some((u) => u.cedula === newCedula.trim())) {
      setError('Ya existe un usuario con ese documento de identificación.');
      return;
    }
    onAdd({
      cedula: newCedula.trim(),
      name: newName.trim(),
      role: newRole,
      specialty: newRole === 'doctor' ? newSpecialty : undefined,
    });
    setNewName('');
    setNewCedula('');
    setNewRole('doctor');
    setNewSpecialty(allSpecialties[0]);
    setError('');
  };

  const handleCreateSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    setAddingSpecialty(true);
    const created = await onAddSpecialty(newSpecialtyName.trim());
    setAddingSpecialty(false);
    if (created) {
      setNewSpecialty(created.name);
      setShowNewSpecialtyInput(false);
      setNewSpecialtyName('');
    } else {
      setError('No se pudo crear la especialidad.');
    }
  };

  const handleCreateSpecialtyForEdit = async () => {
    if (!newSpecialtyName.trim()) return;
    setAddingSpecialty(true);
    const created = await onAddSpecialty(newSpecialtyName.trim());
    setAddingSpecialty(false);
    if (created) {
      setSpecialtyInput(created.name);
      setShowNewSpecialtyInput(false);
      setNewSpecialtyName('');
    } else {
      setError('No se pudo crear la especialidad.');
    }
  };

  const roleIcon = (role: Role) => {
    if (role === 'doctor') return <Stethoscope className="w-4 h-4" />;
    if (role === 'admin') return <Shield className="w-4 h-4" />;
    if (role === 'secretary') return <ClipboardList className="w-4 h-4" />;
    return <UserIcon className="w-4 h-4" />;
  };

  const roleLabel = (role: Role) => {
    if (role === 'doctor') return 'Médico';
    if (role === 'admin') return 'Admin';
    if (role === 'secretary') return 'Secretaría';
    return 'Paciente';
  };

  const roleColor = (role: Role) => {
    if (role === 'doctor') return 'bg-blue-50 text-blue-800';
    if (role === 'admin') return 'bg-slate-100 text-slate-700';
    if (role === 'secretary') return 'bg-teal-50 text-teal-700';
    return 'bg-emerald-50 text-emerald-700';
  };

  const handleSaveSpecialty = async (cedula: string) => {
    setSavingSpecialty(true);
    try {
      await onUpdateSpecialty(cedula, specialtyInput.trim() || 'Médico General');
      setEditingSpecialtyFor(null);
    } catch {
      setError('Error al guardar la especialidad.');
    }
    setSavingSpecialty(false);
  };

  const staffAndPatients = users;

  const roleTabConfig: { key: RoleTab; label: string; icon: typeof UserIcon }[] = [
    { key: 'patient', label: 'Pacientes', icon: UserIcon },
    { key: 'doctor', label: 'Médicos', icon: Stethoscope },
    { key: 'secretary', label: 'Secretarios', icon: ClipboardList },
    { key: 'admin', label: 'Administradores', icon: Shield },
  ];

  const filteredByRole = staffAndPatients.filter((u) => u.role === roleTab);
  const searchQ = searchQuery.toLowerCase().trim();
  const searched = searchQ
    ? filteredByRole.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQ) ||
          u.cedula.includes(searchQuery.trim()),
      )
    : filteredByRole;

  return (
    <div className="space-y-4">
      {/* Add staff form */}
      <form
        onSubmit={handleAdd}
        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-3"
      >
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-700" />
          Registrar Personal / Paciente
        </h3>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Nombre completo
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(''); }}
            placeholder="Ej. Dra. Pérez"
            className="w-full px-4 py-3 rounded-xl border border-slate-200
                       focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                       outline-none transition-all text-slate-800"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Documento de identificación
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              inputMode="numeric"
              value={newCedula}
              onChange={(e) => { setNewCedula(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="Ej. 12345678"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200
                         focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                         outline-none transition-all text-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">Rol</label>
          <div className="grid grid-cols-4 gap-2">
            {(['doctor', 'secretary', 'patient', 'admin'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setNewRole(r)}
                className={`flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                  newRole === r
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {roleIcon(r)}
                {roleLabel(r)}
              </button>
            ))}
          </div>
        </div>

        {newRole === 'doctor' && (
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">
              Especialidad / Rol
            </label>
            <div className="grid grid-cols-2 gap-2">
              {allSpecialties.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewSpecialty(s)}
                  className={`py-2.5 rounded-lg text-xs font-medium transition-all border text-center ${
                    newSpecialty === s
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {showNewSpecialtyInput ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={newSpecialtyName}
                  onChange={(e) => setNewSpecialtyName(e.target.value)}
                  placeholder="Nombre de la nueva especialidad..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateSpecialty}
                  disabled={addingSpecialty || !newSpecialtyName.trim()}
                  className="bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addingSpecialty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewSpecialtyInput(false); setNewSpecialtyName(''); }}
                  className="text-slate-400 px-2 py-2 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewSpecialtyInput(true)}
                className="mt-2 w-full py-2.5 rounded-lg text-xs font-medium border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Otra especialidad
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl
                     hover:bg-blue-800 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Agregar
        </button>
      </form>

      {/* User list with delete (admin only) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up">
        <h3 className="font-semibold text-slate-800 mb-1">
          Usuarios registrados
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Como Administrador Global, puedes eliminar cualquier usuario.
        </p>

        {/* Role sub-tabs */}
        <TabStrip className="bg-slate-100 rounded-xl p-1 mb-3">
          {roleTabConfig.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setRoleTab(rt.key)}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                roleTab === rt.key
                  ? 'bg-white text-blue-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-600'
              }`}
            >
              <rt.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{rt.label}</span>
            </button>
          ))}
        </TabStrip>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar por nombre o cédula en ${roleTabConfig.find((r) => r.key === roleTab)?.label}...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200
                       focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                       outline-none transition-all text-slate-800 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-2">
          {searched.length} {searched.length === 1 ? 'usuario' : 'usuarios'}
          {searchQ && ` encontrados`} en {roleTabConfig.find((r) => r.key === roleTab)?.label}
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {searched.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              {searchQ
                ? `No se encontraron resultados para "${searchQuery}".`
                : `No hay ${roleTabConfig.find((r) => r.key === roleTab)?.label.toLowerCase()} registrados.`}
            </p>
          )}
          {searched.map((u) => (
            <div
              key={u.cedula}
              className="p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${roleColor(u.role)}`}>
                  {roleIcon(u.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400">CC: {u.cedula} · {roleLabel(u.role)}{u.role === 'doctor' && u.specialty ? ` · ${u.specialty}` : ''}</p>
                </div>
                {u.role === 'doctor' && (
                  <button
                    onClick={() => {
                      if (editingSpecialtyFor === u.cedula) {
                        setEditingSpecialtyFor(null);
                      } else {
                        setEditingSpecialtyFor(u.cedula);
                        setSpecialtyInput(u.specialty ?? allSpecialties[0]);
                      }
                    }}
                    className="text-slate-300 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Editar especialidad"
                  >
                    <Stethoscope className="w-4 h-4" />
                  </button>
                )}
                {u.cedula !== adminCedula && (
                  <button
                    onClick={() => onRemove(u.cedula, u.name)}
                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingSpecialtyFor === u.cedula && (
                <div className="mt-2.5 pl-12 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {allSpecialties.map((s: string) => (
                      <button
                        key={s}
                        onClick={() => setSpecialtyInput(s)}
                        className={`py-2 rounded-lg text-xs font-medium transition-all border text-center ${
                          specialtyInput === s
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveSpecialty(u.cedula)}
                      disabled={savingSpecialty}
                      className="bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg
                                 hover:bg-blue-800 active:scale-[0.98] transition-all
                                 disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {savingSpecialty ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingSpecialtyFor(null)}
                      className="text-slate-400 text-sm px-2 py-2 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Specialty management with inline edit */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up">
        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-blue-700" />
          Especialidades ({specialties.length})
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Doble clic en una especialidad para editar su nombre.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {specialties.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No hay especialidades registradas.</p>
          )}
          {specialties.map((spec) => (
            <div key={spec.id}>
              {editingSpecialtyId === spec.id ? (
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                  <input
                    type="text"
                    value={editingSpecialtyName}
                    onChange={(e) => setEditingSpecialtyName(e.target.value)}
                    onKeyDown={handleSpecialtyNameKeyDown}
                    autoFocus
                    disabled={savingSpecialtyName}
                    className="flex-1 px-3 py-2 rounded-lg border border-blue-300 text-sm text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  <button
                    onClick={handleSaveSpecialtyName}
                    disabled={savingSpecialtyName}
                    className="bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {savingSpecialtyName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                  <button
                    onClick={cancelEditingSpecialty}
                    disabled={savingSpecialtyName}
                    className="text-slate-400 px-2 py-2 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDoubleClick={() => startEditingSpecialty(spec)}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer group"
                  title="Doble clic para editar"
                >
                  <span className="text-sm font-medium text-slate-800">{spec.name}</span>
                  <span className="text-xs text-slate-300 group-hover:text-blue-500 transition-colors">
                    Doble clic para editar
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParamsTab({
  sede,
  onSave,
  onReset,
}: {
  sede: { consultationMinutes: number };
  onSave: (s: Partial<typeof sede>) => void;
  onReset: () => void;
}) {
  const [consultationMinutes, setConsultationMinutes] = useState(String(sede.consultationMinutes));
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSave = () => {
    onSave({
      consultationMinutes: parseInt(consultationMinutes) || 15,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-700" />
          Parámetros de Atención
        </h3>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Tiempo por consulta (minutos)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={consultationMinutes}
            onChange={(e) => setConsultationMinutes(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200
                       focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                       outline-none transition-all text-slate-800"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Se usa para calcular el tiempo estimado de espera de cada paciente.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-700 text-white font-semibold py-3.5 rounded-xl
                     hover:bg-blue-800 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              ¡Guardado!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Guardar parámetros
            </>
          )}
        </button>
      </div>

      {/* Reset */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up">
        <h3 className="font-semibold text-slate-800 mb-2">Datos del sistema</h3>
        <p className="text-sm text-slate-500 mb-3">
          Restablece todos los datos (citas, cola) a los valores iniciales.
        </p>
        {confirmReset ? (
          <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-2">
            <span className="text-sm text-amber-800">¿Confirmar reinicio?</span>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                No
              </button>
              <button
                onClick={() => { onReset(); setConfirmReset(false); }}
                className="text-sm px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
              >
                Sí, reiniciar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full text-sm text-slate-400 py-2.5 flex items-center justify-center gap-1.5
                       hover:text-slate-600 border border-slate-200 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Reiniciar datos del sistema
          </button>
        )}
      </div>
    </div>
  );
}
