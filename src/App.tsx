import React, { useState } from 'react';
import { Calendar, Users, Download, Filter, Plus, AlertTriangle, Settings, Copy, RotateCcw, FileText, Edit, X, HelpCircle } from 'lucide-react';

// Imports dos módulos existentes na estrutura
import WeekendDay from './components/tabs/WeekendDay.tsx';

// Types (mantidos)
interface Employee {
  id: number;
  name: string;
  type: 'always_office' | 'always_home' | 'variable';
  isManager: boolean;
  team: string;
  preferences: Record<string, string>;
  officeDays: number;
  workingHours: string;
}

interface Filters {
  employee: string;
  team: string;
  currentStatus: string;
}

interface PersonFilters {
  name: string;
  type: string;
}

interface VacationData {
  start: string;
  end: string;
}

interface ChangeHistoryItem {
  id: number;
  timestamp: Date;
  action: string;
}

interface ConfirmModalData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type: 'warning' | 'danger' | 'info';
}

// Constants (mantidos)
const STATUS_COLORS = {
  office: 'bg-green-500',
  home: 'bg-blue-500',
  vacation: 'bg-orange-500',
  holiday: 'bg-gray-500'
};

const STATUS_LABELS = {
  office: '🟢 Presencial',
  home: '🔵 Home Office',
  vacation: '🟠 Férias',
  holiday: '⚫ Plantão/Feriado'
};

const EMPLOYEE_TYPES = {
  always_office: 'Sempre Presencial',
  always_home: 'Sempre Home Office',
  variable: 'Presença Variável'
};

const WORKING_HOURS = {
  '9-17': { label: '9h às 17h', start: 9, end: 17 },
  '10-18': { label: '10h às 18h', start: 10, end: 18 },
  '11-19': { label: '11h às 19h', start: 11, end: 19 }
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TEMPLATES = {
  '3x2': { name: '3 Presencial + 2 Home Office', pattern: ['office', 'office', 'office', 'home', 'home'] },
  '4x1': { name: '4 Presencial + 1 Home Office', pattern: ['office', 'office', 'office', 'office', 'home'] },
  '2x3': { name: '2 Presencial + 3 Home Office', pattern: ['office', 'office', 'home', 'home', 'home'] },
  'alternate': { name: 'Alternado', pattern: ['office', 'home', 'office', 'home', 'office'] },
  'manager_rotation': { name: 'Meta de Gestores (Mín. 2)', pattern: ['office', 'home'], description: 'Garante mínimo de 2 gestores presenciais por dia' },
  'manual': { name: '100% Manual', pattern: [], description: 'Controle total pelo usuário - clique no calendário para ajustar' }
};

// Utility Functions (mantidas)
const dateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }
  
  return days;
};

const getDisplayName = (fullName: string): string => {
  const names = fullName.trim().split(' ');
  return names.length >= 2 ? `${names[0]} ${names[1]}` : names[0] || '';
};

const getSortedEmployees = (employeesList: Employee[]): Employee[] => {
  return [...employeesList].sort((a, b) => {
    if (a.isManager && !b.isManager) return -1;
    if (!a.isManager && b.isManager) return 1;
    return a.name.localeCompare(b.name);
  });
};

const App = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [schedules, setSchedules] = useState<Record<string, Record<string, string>>>({});
  const [vacations, setVacations] = useState<Record<string, { start: string; end: string }>>({});
  const [maxCapacity, setMaxCapacity] = useState(10);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');
  const [userRole, setUserRole] = useState('admin');
  
  const [filters, setFilters] = useState<Filters>({ employee: '', team: '', currentStatus: '' });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    name: '', type: 'variable', isManager: false, team: '', officeDays: 3, workingHours: '9-17'
  });

  const [selectedPerson, setSelectedPerson] = useState<Employee | null>(null);
  const [editingPerson, setEditingPerson] = useState<Employee | null>(null);
  const [expandedPersonId, setExpandedPersonId] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activePersonTab, setActivePersonTab] = useState('dados');
  const [personFilters, setPersonFilters] = useState<PersonFilters>({ name: '', type: '' });
  const [showVacationForm, setShowVacationForm] = useState(false);
  const [vacationPersonId, setVacationPersonId] = useState<number | null>(null);
  const [vacationData, setVacationData] = useState<VacationData>({ start: '', end: '' });
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryItem[]>([]);
  const [holidays, setHolidays] = useState<Record<string, boolean>>({});
  const [holidayStaff, setHolidayStaff] = useState<Record<string, number[]>>({});
  const [weekendShifts, setWeekendShifts] = useState<Record<string, boolean>>({});
  const [weekendStaff, setWeekendStaff] = useState<Record<string, number[]>>({});
  const [targetOfficeCount, setTargetOfficeCount] = useState(6);
  const [targetOfficeMode, setTargetOfficeMode] = useState('absolute');
  const [showHelp, setShowHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('basico');
  
  const [showManualTemplateModal, setShowManualTemplateModal] = useState(false);
  const [manualTemplateOption, setManualTemplateOption] = useState('blank');
  
  const [reportPeriodMode, setReportPeriodMode] = useState('month');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [selectedReportMonth, setSelectedReportMonth] = useState(currentDate);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<ConfirmModalData>({
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: () => {},
    onCancel: () => {},
    type: 'warning'
  });

  // Derived data
  const teams = [...new Set(employees.map(emp => emp.team).filter(team => team && team.trim() !== ''))];
  const days = getDaysInMonth(currentDate);

  // Effects e funções (mantidas as existentes)
  React.useEffect(() => {
    if (userRole === 'employee' && activeTab !== 'calendar') {
      setActiveTab('calendar');
    }
  }, [userRole, activeTab]);

  // Funções de modal (mantidas)
  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmModalData({
      title,
      message,
      confirmText: type === 'danger' ? 'Excluir' : 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        onConfirm();
        setShowConfirmModal(false);
      },
      onCancel: () => setShowConfirmModal(false),
      type
    });
    setShowConfirmModal(true);
  };

  const showAlert = (title: string, message: string, type: 'warning' | 'danger' | 'info' = 'info') => {
    setConfirmModalData({
      title,
      message,
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => setShowConfirmModal(false),
      onCancel: () => setShowConfirmModal(false),
      type
    });
    setShowConfirmModal(true);
  };

  // Service functions (mantidas as existentes)
  const getEmployeeStatus = (employeeId: number, date: Date): string | null => {
    const dateStr = dateToString(date);
    
    if (holidays[dateStr]) {
      if (holidayStaff[dateStr] && holidayStaff[dateStr].includes(employeeId)) {
        return 'holiday';
      }
      return 'holiday';
    }
    
    const dayOfWeek = date.getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && weekendShifts[dateStr]) {
      if (weekendStaff[dateStr] && weekendStaff[dateStr].includes(employeeId)) {
        return 'holiday';
      }
      return 'holiday';
    }
    
    if (vacations[employeeId]) {
      const vacation = vacations[employeeId];
      if (dateStr >= vacation.start && dateStr <= vacation.end) {
        return 'vacation';
      }
    }
    
    if (schedules[employeeId] && schedules[employeeId][dateStr]) {
      return schedules[employeeId][dateStr];
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return null;
    
    switch (employee.type) {
      case 'always_office':
        return 'office';
      case 'always_home':
        return 'home';
      case 'variable':
        return null;
      default:
        return null;
    }
  };

  const getOfficeCount = (date: Date): number => {
    const dateStr = dateToString(date);
    const dayOfWeek = date.getDay();
    
    if (holidays[dateStr]) {
      return holidayStaff[dateStr] ? holidayStaff[dateStr].length : 0;
    }
    
    if ((dayOfWeek === 0 || dayOfWeek === 6) && weekendShifts[dateStr]) {
      return weekendStaff[dateStr] ? weekendStaff[dateStr].length : 0;
    }
    
    return employees.filter(emp => getEmployeeStatus(emp.id, date) === 'office').length;
  };

  const setEmployeeStatus = (employeeId: number, date: Date, status: string) => {
    const dateStr = dateToString(date);
    const employee = employees.find(emp => emp.id === employeeId);
    
    const change = {
      id: Date.now(),
      timestamp: new Date(),
      action: `Alterou ${employee?.name} em ${date.toLocaleDateString()} para ${STATUS_LABELS[status as keyof typeof STATUS_LABELS]}`
    };
    setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
    
    setSchedules(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [dateStr]: status
      }
    }));
  };

  const addEmployee = () => {
    if (newEmployee.name.trim()) {
      const newPerson: Employee = {
        id: Date.now(),
        name: newEmployee.name,
        type: newEmployee.type as 'always_office' | 'always_home' | 'variable',
        isManager: newEmployee.isManager,
        team: newEmployee.team,
        officeDays: newEmployee.officeDays,
        workingHours: newEmployee.workingHours,
        preferences: {}
      };
      setEmployees(prev => [...prev, newPerson]);
      setNewEmployee({ name: '', type: 'variable', isManager: false, team: '', officeDays: 3, workingHours: '9-17' });
      setShowAddEmployee(false);
      
      setExpandedPersonId(newPerson.id);
      setEditingPerson(newPerson);
      setHasUnsavedChanges(false);
      setActivePersonTab('dados');
    }
  };

  // Função de importação em massa
  const importEmployees = () => {
    if (!importText.trim()) return;
    
    const names = importText.trim().split('\n').filter(name => name.trim() !== '');
    const newEmployees = names.map((name, index) => ({
      id: Date.now() + index,
      name: name.trim(),
      type: 'variable' as const,
      isManager: false,
      team: '',
      preferences: {},
      officeDays: 3,
      workingHours: '9-17'
    }));
    
    setEmployees(prev => [...prev, ...newEmployees]);
    
    const change = {
      id: Date.now(),
      timestamp: new Date(),
      action: `Importou ${newEmployees.length} pessoas em lote`
    };
    setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
    
    setImportText('');
    setShowImportModal(false);
    
    showAlert(
      '✅ Importação Concluída!',
      `${newEmployees.length} pessoas foram adicionadas com sucesso!\n\nTodas foram configuradas como "Presença Variável" (9h-17h) por padrão.`,
      'info'
    );
  };

  const exportToExcel = () => {
    const days = getDaysInMonth(currentDate).filter(day => day !== null) as Date[];
    let csvContent = 'Nome,Equipe,';
    
    days.forEach(day => {
      csvContent += `${day.getDate()}/${day.getMonth() + 1},`;
    });
    csvContent += '\n';
    
    employees.forEach(emp => {
      csvContent += `${emp.name},${emp.team || 'Sem equipe'},`;
      days.forEach(day => {
        const status = getEmployeeStatus(emp.id, day);
        const statusText = status ? STATUS_LABELS[status as keyof typeof STATUS_LABELS] : '';
        csvContent += `${statusText},`;
      });
      csvContent += '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Função de reset do sistema
  const startNewSchedule = () => {
    showConfirm(
      '🔄 Iniciar Nova Escala',
      'ATENÇÃO: Esta ação irá:\n\n• Apagar TODAS as pessoas\n• Limpar TODAS as escalas\n• Remover equipes e histórico\n\nTem certeza?',
      () => {
        const newEmployees: Employee[] = [];
        
        setEmployees(newEmployees);
        setSchedules({});
        setVacations({});
        setHolidays({});
        setHolidayStaff({});
        setWeekendShifts({});
        setWeekendStaff({});
        setChangeHistory([]);
        setSelectedPerson(null);
        setEditingPerson(null);
        setExpandedPersonId(null);
        setHasUnsavedChanges(false);
        setActivePersonTab('dados');
        setVacationPersonId(null);
        setFilters({ employee: '', team: '', currentStatus: '' });
        setPersonFilters({ name: '', type: '' });
        
        const change = {
          id: Date.now(),
          timestamp: new Date(),
          action: `🔄 NOVA ESCALA - Sistema completamente resetado`
        };
        setChangeHistory([change]);
        
        showAlert(
          '✅ Nova Escala Iniciada!',
          'Sistema completamente resetado\nTodas as pessoas foram removidas',
          'info'
        );
      },
      'danger'
    );
  };

  const getFilteredEmployees = () => {
    return employees.filter(emp => {
      if (filters.employee && !emp.name.toLowerCase().includes(filters.employee.toLowerCase())) {
        return false;
      }
      if (filters.team) {
        if (filters.team === 'SEM_EQUIPE') {
          return !emp.team || emp.team.trim() === '';
        } else {
          return emp.team === filters.team;
        }
      }
      if (filters.currentStatus) {
        return true;
      }
      return true;
    });
  };

  // Função para filtrar pessoas na aba Pessoas
  const getFilteredPeople = () => {
    return employees.filter(person => {
      if (personFilters.name && !person.name.toLowerCase().includes(personFilters.name.toLowerCase())) {
        return false;
      }
      if (personFilters.type) {
        if (personFilters.type === 'manager' && !person.isManager) return false;
        if (personFilters.type === 'employee' && person.isManager) return false;
      }
      return true;
    });
  };

  // Função para atualizar pessoa
  const updatePerson = (personId: number, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === personId ? { ...emp, ...updates } : emp
    ));
    
    if (editingPerson && editingPerson.id === personId) {
      setEditingPerson(prev => prev ? ({ ...prev, ...updates }) : null);
    }
    
    const change = {
      id: Date.now(),
      timestamp: new Date(),
      action: `Atualizou dados de ${updates.name || 'funcionário'}`
    };
    setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
  };

  // Função para aplicar templates
  const applyTemplate = (templateKey: string, specificTeam: string | null = null, respectPreferences: boolean = false) => {
    const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (!template) return;
    
    if (templateKey === 'manual') {
      setShowManualTemplateModal(true);
      return;
    }
    
    const targetEmployees = employees.filter(emp => 
      emp.type === 'variable' && 
      (!specificTeam || emp.team === specificTeam)
    );
    
    const affectedCount = targetEmployees.length;
    const alwaysFixedCount = employees.filter(emp => emp.type === 'always_office' || emp.type === 'always_home').length;
    
    let confirmMessage = `Aplicar template "${template.name}"?\n\n`;
    confirmMessage += `📊 Pessoas afetadas:\n`;
    confirmMessage += `• ${affectedCount} pessoas variáveis (serão reconfiguradas)\n`;
    
    if (alwaysFixedCount > 0) {
      confirmMessage += `• ${alwaysFixedCount} sempre fixas (preservadas)\n`;
    }
    
    confirmMessage += `\n🎯 Meta: ${targetOfficeCount} pessoas presenciais por dia\n`;
    
    if (respectPreferences) {
      confirmMessage += `✅ Respeitando preferências individuais\n`;
    }
    
    confirmMessage += `\n⚠️ Configurações manuais existentes serão sobrescritas!`;
    
    showConfirm(
      '📋 Aplicar Template',
      confirmMessage,
      () => {
        executeTemplateApplication(templateKey, targetEmployees, respectPreferences, template);
      },
      'warning'
    );
  };

  // Função para executar aplicação do template
  const executeTemplateApplication = (templateKey: string, targetEmployees: Employee[], respectPreferences: boolean, template: any) => {
    const days = getDaysInMonth(currentDate).filter(day => day && day.getDay() >= 1 && day.getDay() <= 5) as Date[];
    
    // Template de revezamento de gestores
    if (templateKey === 'manager_rotation') {
      const allManagers = employees.filter(emp => emp.isManager);
      const variableManagers = allManagers.filter(emp => emp.type === 'variable');
      
      if (variableManagers.length === 0) {
        showAlert(
          'Nenhum Gestor Variável',
          'Todos os gestores são fixos. Use o template apenas se houver gestores variáveis para distribuir.',
          'warning'
        );
        return;
      }
      
      const metaMinimaGestores = 2;
      const precisoDeVariaveis = Math.max(0, metaMinimaGestores);
      
      days.forEach((day, dayIndex) => {
        const gestoresPresenciaisHoje = [];
        
        for (let i = 0; i < precisoDeVariaveis && i < variableManagers.length; i++) {
          const managerIndex = (dayIndex + i) % variableManagers.length;
          gestoresPresenciaisHoje.push(variableManagers[managerIndex]);
        }
        
        variableManagers.forEach(manager => {
          const status = gestoresPresenciaisHoje.includes(manager) ? 'office' : 'home';
          setEmployeeStatus(manager.id, day, status);
        });
      });
      
      const change = {
        id: Date.now(),
        timestamp: new Date(),
        action: `Aplicou template Gestores - Meta mínima: ${metaMinimaGestores} gestores presenciais por dia`
      };
      setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
      return;
    }

    // Templates normais
    targetEmployees.forEach((emp, empIndex) => {
      days.forEach((day, dayIndex) => {
        const weekdayIndex = (dayIndex + empIndex) % template.pattern.length;
        const status = template.pattern[weekdayIndex];
        setEmployeeStatus(emp.id, day, status);
      });
    });
    
    const change = {
      id: Date.now(),
      timestamp: new Date(),
      action: `Aplicou template ${template.name}${respectPreferences ? ' respeitando preferências' : ''}`
    };
    setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
    
    showAlert(
      '✅ Template Aplicado!',
      `Template "${template.name}" foi aplicado com sucesso!`,
      'info'
    );
  };

  // Função para executar template manual
  const executeManualTemplate = (option: string) => {
    const targetEmployees = employees.filter(emp => emp.type === 'variable');
    const days = getDaysInMonth(currentDate).filter(day => day && day.getDay() >= 1 && day.getDay() <= 5) as Date[];
    
    // Primeiro, limpar todas as configurações existentes
    targetEmployees.forEach(emp => {
      days.forEach(day => {
        const dateStr = dateToString(day);
        setSchedules(prev => ({
          ...prev,
          [emp.id]: {
            ...prev[emp.id],
            [dateStr]: undefined
          }
        }));
      });
    });
    
    // Aplicar a opção escolhida
    if (option === 'all_office') {
      targetEmployees.forEach(emp => {
        days.forEach(day => {
          setEmployeeStatus(emp.id, day, 'office');
        });
      });
    } else if (option === 'all_home') {
      targetEmployees.forEach(emp => {
        days.forEach(day => {
          setEmployeeStatus(emp.id, day, 'home');
        });
      });
    } else if (option === 'distribute_50_50') {
      days.forEach(day => {
        const shuffledEmployees = [...targetEmployees].sort(() => Math.random() - 0.5);
        const halfCount = Math.floor(targetEmployees.length / 2);
        
        shuffledEmployees.forEach((emp, index) => {
          const status = index < halfCount ? 'office' : 'home';
          setEmployeeStatus(emp.id, day, status);
        });
      });
    }
    
    const optionLabels = {
      'blank': 'em branco - configuração limpa',
      'all_office': 'todas as pessoas como presencial',
      'all_home': 'todas as pessoas como home office',
      'distribute_50_50': 'distribuição 50/50 aleatória'
    };
    
    const change = {
      id: Date.now(),
      timestamp: new Date(),
      action: `Aplicou template Manual (${optionLabels[option as keyof typeof optionLabels]})`
    };
    setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
    
    setShowManualTemplateModal(false);
    setManualTemplateOption('blank');
    
    showAlert(
      '✅ Template Manual Aplicado!',
      `Configuração inicial: ${optionLabels[option as keyof typeof optionLabels]}\n\nAgora clique nos nomes no calendário para fazer ajustes conforme necessário.`,
      'info'
    );
  };

  const getFilteredEmployeesForDay = (day: Date) => {
    return employees.filter(emp => {
      if (filters.employee && !emp.name.toLowerCase().includes(filters.employee.toLowerCase())) {
        return false;
      }
      if (filters.team) {
        if (filters.team === 'SEM_EQUIPE') {
          if (emp.team && emp.team.trim() !== '') return false;
        } else {
          if (emp.team !== filters.team) return false;
        }
      }
      
      if (!filters.currentStatus) {
        return true;
      }
      
      const statusNesteDia = getEmployeeStatus(emp.id, day);
      return statusNesteDia === filters.currentStatus;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Escalas de Trabalho</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-sm text-gray-600">👤</div>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:ring-0 focus:outline-none cursor-pointer"
                >
                  <option value="admin">👑 Administrador</option>
                  <option value="manager">👨‍💼 Gestor</option>
                  <option value="employee">👤 Colaborador</option>
                </select>
              </div>
              
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Ajuda e Legendas"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          {/* Tabs - AGORA COM TODAS AS ABAS */}
          <div className="flex gap-4 mt-4 border-b">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`pb-2 px-1 ${activeTab === 'calendar' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Calendário
            </button>
            <button
              onClick={() => userRole !== 'employee' && setActiveTab('people')}
              disabled={userRole === 'employee'}
              className={`pb-2 px-1 transition-all ${
                userRole === 'employee' 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : activeTab === 'people' 
                    ? 'border-b-2 border-blue-600 text-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Pessoas
            </button>
            <button
              onClick={() => userRole !== 'employee' && setActiveTab('templates')}
              disabled={userRole === 'employee'}
              className={`pb-2 px-1 transition-all ${
                userRole === 'employee' 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : activeTab === 'templates' 
                    ? 'border-b-2 border-blue-600 text-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Templates
            </button>
            {/* ABA RELATÓRIOS RECUPERADA */}
            <button
              onClick={() => userRole !== 'employee' && setActiveTab('reports')}
              disabled={userRole === 'employee'}
              className={`pb-2 px-1 transition-all ${
                userRole === 'employee' 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : activeTab === 'reports' 
                    ? 'border-b-2 border-blue-600 text-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
              }`}
              title={userRole === 'employee' ? 'Acesso restrito - apenas visualização de calendário' : ''}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Relatórios
            </button>
            {/* ABA CONFIGURAÇÕES RECUPERADA */}
            <button
              onClick={() => userRole !== 'employee' && setActiveTab('settings')}
              disabled={userRole === 'employee'}
              className={`pb-2 px-1 transition-all ${
                userRole === 'employee' 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : activeTab === 'settings' 
                    ? 'border-b-2 border-blue-600 text-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
              }`}
              title={userRole === 'employee' ? 'Acesso restrito - apenas visualização de calendário' : ''}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Configurações
            </button>
          </div>
        </div>

        {/* Aviso para Colaboradores */}
        {userRole === 'employee' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                👤
              </div>
              <div>
                <h3 className="font-medium text-blue-900">Modo Colaborador</h3>
                <p className="text-sm text-blue-700">
                  Você tem acesso apenas à visualização do calendário. Para gerenciar pessoas, templates e configurações, 
                  contate seu gestor ou administrador.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Tab - MANTIDA COMO ESTAVA */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 max-h-[80vh] overflow-y-auto">
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Colaborador
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      value={filters.employee}
                      onChange={(e) => setFilters(prev => ({ ...prev, employee: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Equipe
                    </label>
                    <select
                      value={filters.team}
                      onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Todas as equipes</option>
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                      <option value="SEM_EQUIPE">Sem equipe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status Atual
                    </label>
                    <select
                      value={filters.currentStatus || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, currentStatus: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Todos os status</option>
                      <option value="office">🟢 Presencial</option>
                      <option value="home">🔵 Home Office</option>
                      <option value="vacation">🟠 Férias</option>
                      <option value="holiday">⚫ Plantão/Feriado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    ←
                  </button>
                  <h2 className="text-xl font-semibold">
                    {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    →
                  </button>
                </div>

                <div className="flex gap-6 mb-4 text-sm">
                  <div className="flex gap-4">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${STATUS_COLORS[key as keyof typeof STATUS_COLORS]}`}></div>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                    <Edit className="w-4 h-4" />
                    <span className="text-xs font-medium">💡 Clique nos nomes para alternar</span>
                  </div>
                  {filters.currentStatus && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-lg">
                      <Filter className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        🔍 Filtro ativo: {STATUS_LABELS[filters.currentStatus as keyof typeof STATUS_LABELS]}
                      </span>
                    </div>
                  )}
                </div>

                {employees.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📅</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma pessoa para exibir</h3>
                    <p className="text-gray-600">Vá para a aba "Pessoas" para adicionar funcionários ao sistema.</p>
                  </div>
                )}

                {employees.length > 0 && (
                  <div className="grid grid-cols-7 gap-1">
                    {WEEK_DAYS.map(day => (
                      <div key={day} className="p-2 text-center font-medium text-gray-700 bg-gray-100">
                        {day}
                      </div>
                    ))}
                    
                    {days.map((day, index) => {
                      if (!day) {
                        return <div key={index} className="p-2 min-h-[200px]"></div>;
                      }
                      
                      const dayOfWeek = day.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const officeCount = getOfficeCount(day);
                      const isOverCapacity = officeCount > maxCapacity;
                      
                      if (isWeekend) {
                        return (
                          <WeekendDay
                            key={index}
                            day={day}
                            weekendShifts={weekendShifts}
                            weekendStaff={weekendStaff}
                            employees={getFilteredEmployeesForDay(day)}
                            userRole={userRole}
                          />
                        );
                      }
                      
                      return (
                        <div key={index} className="border border-gray-200 min-h-[200px]">
                          <div className={`p-1 text-center text-sm font-medium relative ${
                            holidays[dateToString(day)] 
                              ? 'bg-gray-400 text-white' 
                              : isOverCapacity 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-gray-50'
                          }`}>
                            <div className="flex items-center justify-center gap-1">
                              {day.getDate()}
                              {userRole !== 'employee' && (
                                <button
                                  className={`p-1 rounded hover:bg-opacity-70 ${
                                    holidays[dateToString(day)]
                                      ? 'text-white hover:bg-gray-600'
                                      : 'text-gray-500 hover:bg-gray-200'
                                  }`}
                                  title={holidays[dateToString(day)] ? 'Remover feriado' : 'Marcar como feriado'}
                                >
                                  <Calendar className="w-3 h-3" />
                                </button>
                              )}
                              {isOverCapacity && !holidays[dateToString(day)] && (
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                              )}
                            </div>
                          </div>
                          
                          <div className="p-2">
                            <div className="text-xs font-medium text-gray-600 mb-2">🟢 Presencial</div>
                            <div className="space-y-1 min-h-[60px] bg-green-50 p-2 rounded">
                              {getSortedEmployees(getFilteredEmployeesForDay(day)).map(emp => {
                                const status = getEmployeeStatus(emp.id, day);
                                
                                if (status !== 'office') return null;
                                
                                return (
                                  <div
                                    key={emp.id}
                                    className={`text-xs p-2 rounded transition-all ${
                                      userRole !== 'employee' && emp.type === 'variable'
                                        ? 'cursor-pointer hover:opacity-80 hover:scale-105' 
                                        : 'cursor-default'
                                    } ${
                                      emp.isManager 
                                        ? 'bg-green-100 text-green-900 border-2 border-green-600 font-semibold' 
                                        : 'bg-green-50 text-green-800 border-2 border-green-400 font-medium'
                                    }`}
                                    onClick={() => {
                                      if (userRole !== 'employee' && emp.type === 'variable') {
                                        setEmployeeStatus(emp.id, day, 'home');
                                      }
                                    }}
                                    title={`${emp.name} ${emp.isManager ? '(Gestor)' : '(Colaborador)'} ${
                                      emp.type === 'variable' ? '- Clique para alternar' : ''
                                    }`}
                                  >
                                    {getDisplayName(emp.name)}
                                    <span className="ml-1 text-xs opacity-75">
                                      [{emp.workingHours || '9-17'}]
                                    </span>
                                    {userRole !== 'employee' && emp.type === 'variable' && (
                                      <span className="ml-1 text-xs opacity-60">⇄</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            
                            <div className="p-1 text-xs text-center text-gray-600 border-t mt-2">
                              {officeCount}/{maxCapacity} no escritório
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* People Tab - VERSÃO COMPLETA RECUPERADA */}
        {activeTab === 'people' && userRole !== 'employee' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Gerenciar Pessoas</h3>
                <div className="flex items-center gap-4">
                  {/* SISTEMA DE META PRESENCIAL RECUPERADO */}
                  <div className="flex items-center gap-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-medium">Meta presencial:</span>
                      <input
                        type="number"
                        value={targetOfficeCount}
                        onChange={(e) => setTargetOfficeCount(Number(e.target.value))}
                        className="w-16 px-2 py-1 border rounded text-center font-medium"
                        min="0"
                      />
                      <span className="text-sm text-gray-700">pessoas</span>
                    </div>
                    
                    <div className="flex items-center gap-3 border-l border-blue-300 pl-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="targetMode"
                          value="absolute"
                          checked={targetOfficeMode === 'absolute'}
                          onChange={(e) => setTargetOfficeMode(e.target.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium text-blue-900">🎯 Absoluta</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="targetMode"
                          value="minimum"
                          checked={targetOfficeMode === 'minimum'}
                          onChange={(e) => setTargetOfficeMode(e.target.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium text-blue-900">📊 Mínima</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="text-xs text-blue-700 max-w-xs">
                    {targetOfficeMode === 'absolute' 
                      ? `🎯 Exatamente ${targetOfficeCount} pessoas presenciais (ajusta automaticamente)`
                      : `📊 Pelo menos ${targetOfficeCount} pessoas presenciais (permite mais)`
                    }
                  </div>
                  
                  {/* BOTÃO IMPORTAR LISTA RECUPERADO */}
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FileText className="w-4 h-4" />
                    Importar Lista
                  </button>
                  <button
                    onClick={() => setShowAddEmployee(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Nova Pessoa
                  </button>
                </div>
              </div>

              {/* FILTROS ADICIONADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar por nome
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={personFilters.name}
                    onChange={(e) => setPersonFilters(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={personFilters.type}
                    onChange={(e) => setPersonFilters(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="manager">Gestores</option>
                    <option value="employee">Colaboradores</option>
                  </select>
                </div>
              </div>

              <div className="border rounded-lg p-4" style={{ maxHeight: '70vh', minHeight: '60vh' }}>
                {employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="text-6xl mb-4">👥</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma pessoa cadastrada</h3>
                    <p className="text-gray-600 mb-6 max-w-md">
                      Comece adicionando pessoas individualmente ou importe uma lista completa de uma só vez.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <FileText className="w-4 h-4" />
                        Importar Lista
                      </button>
                      <button
                        onClick={() => setShowAddEmployee(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Pessoa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getSortedEmployees(getFilteredPeople()).map(person => (
                      <div
                        key={person.id}
                        className="border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-lg">
                              {person.type === 'always_office' ? '🟢' : 
                               person.type === 'always_home' ? '🔵' : '⚪'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base truncate flex items-center gap-2">
                                {person.name}
                                {person.isManager && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                    Gestor
                                  </span>
                                )}
                              </div>
                              {person.team && (
                                <div className="text-sm text-gray-600 mt-1">{person.team}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {EMPLOYEE_TYPES[person.type]} • {WORKING_HOURS[person.workingHours]?.label || '9h-17h'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setExpandedPersonId(person.id);
                                setEditingPerson(person);
                                setHasUnsavedChanges(false);
                                setActivePersonTab('dados');
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Editar pessoa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                showConfirm(
                                  '❌ Excluir Pessoa',
                                  `Tem certeza que deseja excluir ${person.name}?`,
                                  () => {
                                    setEmployees(prev => prev.filter(emp => emp.id !== person.id));
                                    
                                    if (expandedPersonId === person.id) {
                                      setExpandedPersonId(null);
                                      setEditingPerson(null);
                                      setHasUnsavedChanges(false);
                                    }
                                    
                                    setSchedules(prev => {
                                      const newSchedules = { ...prev };
                                      delete newSchedules[person.id];
                                      return newSchedules;
                                    });
                                    
                                    setVacations(prev => {
                                      const newVacations = { ...prev };
                                      delete newVacations[person.id];
                                      return newVacations;
                                    });
                                    
                                    if (selectedPerson && selectedPerson.id === person.id) {
                                      setSelectedPerson(null);
                                    }
                                    
                                    const change = {
                                      id: Date.now(),
                                      timestamp: new Date(),
                                      action: `❌ Excluiu a pessoa ${person.name}`
                                    };
                                    setChangeHistory(prev => [change, ...prev.slice(0, 99)]);
                                  },
                                  'danger'
                                );
                              }}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Excluir pessoa"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab - VERSÃO COMPLETA FUNCIONAL */}
        {activeTab === 'templates' && userRole !== 'employee' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold mb-4">Templates de Escala</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Aplicar Template</h4>
                  <div className="space-y-3 border rounded-lg p-4">
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                      <div key={key} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{template.name}</h5>
                          <div className="flex gap-2">
                            <button
                              onClick={() => applyTemplate(key, null, false)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              title="Aplicar template substituindo todas as configurações"
                            >
                              Aplicar
                            </button>
                            {key !== 'manager_rotation' && key !== 'manual' && (
                              <button
                                onClick={() => applyTemplate(key, null, true)}
                                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                title="Aplicar template respeitando preferências individuais"
                              >
                                + Preferências
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 mb-2">
                          {key === 'manager_rotation' ? (
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-purple-600" />
                              <span className="text-xs text-purple-600">Gestores</span>
                            </div>
                          ) : key === 'manual' ? (
                            <div className="flex items-center gap-1">
                              <Edit className="w-4 h-4 text-gray-600" />
                              <span className="text-xs text-gray-600">Controle Manual</span>
                            </div>
                          ) : (
                            template.pattern.map((status, index) => (
                              <div
                                key={index}
                                className={`w-4 h-4 rounded ${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}`}
                                title={STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                              ></div>
                            ))
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {template.description || 
                           (key === 'manager_rotation' 
                            ? 'Mínimo de 2 gestores presenciais por dia'
                            : key === 'manual'
                              ? 'Configuração manual no calendário'
                            : `Seg - Sex: ${template.pattern.map(p => p === 'office' ? '🟢' : '🔵').join(' ')}`
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Ações Rápidas</h4>
                  <div className="space-y-3 border rounded-lg p-4">
                    <button
                      onClick={() => {
                        // Implementar cópia da primeira semana
                        showAlert('Em Desenvolvimento', 'Funcionalidade será implementada em breve!', 'info');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    >
                      <Copy className="w-4 h-4" />
                      Replicar 1ª Semana
                    </button>
                    <button
                      onClick={() => applyTemplate('4x1')}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Aplicar 4x1
                    </button>
                    <button
                      onClick={() => applyTemplate('manager_rotation')}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                    >
                      <Users className="w-4 h-4" />
                      Meta de Gestores
                    </button>
                    <button
                      onClick={() => applyTemplate('manual')}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                    >
                      <Edit className="w-4 h-4" />
                      Modo Manual
                    </button>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Informações</h4>
                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      <div className="text-blue-800 font-medium mb-2">📋 Como usar Templates:</div>
                      <div className="text-blue-700 space-y-1">
                        <div>• <strong>Aplicar:</strong> Substitui configurações existentes</div>
                        <div>• <strong>+ Preferências:</strong> Respeita dias preferenciais</div>
                        <div>• <strong>Meta Gestores:</strong> Garante mínimo de gestores</div>
                        <div>• <strong>Manual:</strong> Você controla cada pessoa</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab - VERSÃO RECUPERADA */}
        {activeTab === 'reports' && userRole !== 'employee' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold mb-4">📊 Relatórios</h3>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold mb-4">Histórico de Alterações</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                  {changeHistory.slice(0, 10).map(change => (
                    <div key={change.id} className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm">
                      <span>{change.action}</span>
                      <span className="text-gray-500">{change.timestamp.toLocaleString()}</span>
                    </div>
                  ))}
                  {changeHistory.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      Nenhuma alteração registrada ainda
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab - VERSÃO RECUPERADA */}
        {activeTab === 'settings' && userRole !== 'employee' && (
          <div className="space-y-6">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-800 mb-2">🔄 Iniciar Nova Escala</h3>
                  <p className="text-sm text-red-700 mb-1">
                    <strong>⚠️ CUIDADO:</strong> Reset completo do sistema!
                  </p>
                  <p className="text-xs text-red-600">
                    Remove TODAS as pessoas e limpa todas as escalas.
                  </p>
                </div>
                <button
                  onClick={startNewSchedule}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold border-2 border-red-800 transition-all hover:scale-105"
                >
                  <RotateCcw className="w-5 h-5" />
                  Iniciar Nova Escala
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold mb-4">Configurações do Sistema</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Capacidade e Metas</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacidade Máxima do Escritório (Indicador Visual)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={maxCapacity}
                          onChange={(e) => setMaxCapacity(Number(e.target.value))}
                          className="flex-1 px-3 py-2 border rounded-lg"
                          min="1"
                        />
                        <span className="text-sm text-gray-600">pessoas</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        📊 Apenas para alerta visual - não limita a meta presencial
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Add Employee - MANTIDO */}
        {showAddEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Adicionar Nova Pessoa</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Equipe"
                    value={newEmployee.team}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, team: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <select
                    value={newEmployee.type}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="variable">Presença Variável</option>
                    <option value="always_office">Sempre Presencial</option>
                    <option value="always_home">Sempre Home Office</option>
                  </select>
                  <select
                    value={newEmployee.workingHours}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, workingHours: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {Object.entries(WORKING_HOURS).map(([key, hours]) => (
                      <option key={key} value={key}>{hours.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEmployee.isManager}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, isManager: e.target.checked }))}
                    />
                    <span className="text-sm">Gestor</span>
                  </label>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={addEmployee}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={() => setShowAddEmployee(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importação em Massa - RECUPERADO */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">📋 Importar Lista de Pessoas</h3>
                
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <div className="text-sm text-blue-800">
                    <strong>💡 Como usar:</strong>
                    <div className="mt-1 space-y-1">
                      <div>• Cole ou digite um nome por linha</div>
                      <div>• Todas as pessoas serão criadas como "Presença Variável"</div>
                      <div>• Horário padrão: 9h às 17h (você pode editar depois)</div>
                      <div>• Você pode editá-las individualmente depois</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Lista de Nomes (um por linha):
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="João da Silva&#10;Maria Santos&#10;Pedro Oliveira&#10;Ana Costa"
                    className="w-full px-3 py-2 border rounded-lg h-40 resize-none"
                    rows={8}
                  />
                  <div className="text-xs text-gray-500">
                    {importText.trim() ? `${importText.trim().split('\n').filter(n => n.trim()).length} pessoas para importar` : 'Nenhuma pessoa para importar'}
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={importEmployees}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    disabled={!importText.trim()}
                  >
                    ✅ Importar Pessoas
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportText('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Template Manual */}
        {showManualTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">🎯 Configurar Template Manual</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 font-medium mb-3">
                    Como você quer inicializar as pessoas no calendário?
                  </p>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="manualOption"
                        value="blank"
                        checked={manualTemplateOption === 'blank'}
                        onChange={(e) => setManualTemplateOption(e.target.value)}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">⚫ Deixar em branco</div>
                        <div className="text-sm text-gray-600">
                          Pessoas não aparecem no calendário • Você define uma por uma do zero
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="manualOption"
                        value="all_office"
                        checked={manualTemplateOption === 'all_office'}
                        onChange={(e) => setManualTemplateOption(e.target.value)}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">🟢 Iniciar todas como Presencial</div>
                        <div className="text-sm text-gray-600">
                          Todas as pessoas aparecem no escritório • Clique nos nomes para mandar para home office
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="manualOption"
                        value="all_home"
                        checked={manualTemplateOption === 'all_home'}
                        onChange={(e) => setManualTemplateOption(e.target.value)}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">🔵 Iniciar todas como Home Office</div>
                        <div className="text-sm text-gray-600">
                          Todas as pessoas aparecem em casa • Clique nos nomes para trazer ao escritório
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="manualOption"
                        value="distribute_50_50"
                        checked={manualTemplateOption === 'distribute_50_50'}
                        onChange={(e) => setManualTemplateOption(e.target.value)}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">⚡ Distribuir automaticamente (50/50)</div>
                        <div className="text-sm text-gray-600">
                          Metade presencial, metade home office • Distribuição aleatória como ponto de partida
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg mb-6">
                  <div className="text-sm text-blue-800">
                    <strong>💡 Explicação:</strong>
                    <div className="mt-1">
                      O Template Manual limpa todas as configurações automáticas e te dá controle total. 
                      Escolha como quer que as pessoas apareçam inicialmente no calendário - depois é só 
                      clicar nos nomes para alternar entre presencial/home office conforme sua necessidade.
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => executeManualTemplate(manualTemplateOption)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Aplicar Template
                  </button>
                  <button
                    onClick={() => {
                      setShowManualTemplateModal(false);
                      setManualTemplateOption('blank');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação - MANTIDO */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                    confirmModalData.type === 'danger' ? 'bg-red-100 text-red-600' :
                    confirmModalData.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {confirmModalData.type === 'danger' ? '⚠️' :
                     confirmModalData.type === 'warning' ? '❓' : 'ℹ️'}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {confirmModalData.title}
                  </h3>
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700 whitespace-pre-line">
                    {confirmModalData.message}
                  </p>
                </div>
                
                <div className="flex gap-3">
                  {confirmModalData.cancelText && (
                    <button
                      onClick={confirmModalData.onCancel}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      {confirmModalData.cancelText}
                    </button>
                  )}
                  <button
                    onClick={confirmModalData.onConfirm}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                      confirmModalData.type === 'danger' 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {confirmModalData.confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;