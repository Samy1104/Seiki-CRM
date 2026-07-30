import React from 'react';
import { CheckCircle2, Clock, Calendar, UserCheck } from 'lucide-react';
import type { Task } from '../../services/tasksService';
import type { TeamMember } from '../../services/settingsService';
import { groupTasksByMember, type GroupedTaskResult } from '../../utils/dashboardCalculations';

export interface DashboardTasksTabProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  startDateA?: string;
  endDateA?: string;
}

export const DashboardTasksTab: React.FC<DashboardTasksTabProps> = ({
  tasks,
  teamMembers,
  startDateA,
  endDateA,
}) => {
  const groupedTasks: GroupedTaskResult[] = groupTasksByMember(tasks, teamMembers, startDateA, endDateA);

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Haute
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4C4A8]/10 text-[#D4C4A8] border border-[#D4C4A8]/20">
            Moyenne
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Basse
          </span>
        );
    }
  };

  const priorityWeight = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
      default:
        return 1;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#141414] border border-line rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#f2ede4]">Répartition des Tâches par Membre d'Équipe</h3>
            <p className="text-xs text-ink-soft">
              Suivi individuel des réalisations et des tâches en attente prioritaires
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto font-mono text-xs">
          <div className="px-3 py-1.5 bg-[#1e1e1e] border border-line rounded-xl text-emerald-400 font-bold">
            {groupedTasks.reduce((sum, g) => sum + g.completedInPeriod.length, 0)} accomplies
          </div>
          <div className="px-3 py-1.5 bg-[#1e1e1e] border border-line rounded-xl text-[#D4C4A8] font-bold">
            {groupedTasks.reduce((sum, g) => sum + g.pending.length, 0)} en attente
          </div>
        </div>
      </div>

      {/* Member Cards Grid */}
      {groupedTasks.length === 0 ? (
        <div className="bg-[#141414] border border-line rounded-2xl p-8 text-center text-xs text-ink-faint italic">
          Aucun membre d'équipe enregistré.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groupedTasks.map(({ member, completedInPeriod, pending }) => {
            // Sort pending tasks by priority (High > Medium > Low) then due_date
            const sortedPending = [...pending].sort((a, b) => {
              const pwA = priorityWeight(a.priority);
              const pwB = priorityWeight(b.priority);
              if (pwB !== pwA) return pwB - pwA;
              const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
              const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
              return dateA - dateB;
            });

            return (
              <div
                key={member.id}
                className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4 flex flex-col justify-between"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-[#0d0d0d] shadow-sm"
                      style={{ backgroundColor: member.color || '#D4C4A8' }}
                    >
                      {member.initials || member.full_name?.slice(0, 2).toUpperCase() || 'TM'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#f2ede4]">{member.full_name || 'Membre d\'équipe'}</h4>
                      <p className="text-[11px] text-ink-soft">{member.role_label || 'Commercial'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded-md">
                      {completedInPeriod.length} accomplie{completedInPeriod.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-[#D4C4A8]/10 text-[#D4C4A8] border border-[#D4C4A8]/20 font-bold rounded-md">
                      {pending.length} à faire
                    </span>
                  </div>
                </div>

                {/* Content: Completed & Pending Sections */}
                <div className="space-y-4 flex-1">
                  {/* Completed Tasks Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Réalisations de la période ({completedInPeriod.length})</span>
                    </div>

                    {completedInPeriod.length === 0 ? (
                      <p className="text-[11px] text-ink-faint italic pl-5">Aucune tâche finalisée sur cette période.</p>
                    ) : (
                      <div className="space-y-1.5 pl-2 max-h-[140px] overflow-y-auto pr-1">
                        {completedInPeriod.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-2 p-2 bg-[#1e1e1e]/60 rounded-lg border border-line/40 text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="flex-1 space-y-0.5">
                              <p className="text-[#f2ede4] font-medium line-through opacity-80">{task.description}</p>
                              {task.lead && (
                                <p className="text-[10px] text-ink-soft">Lead: {task.lead.company_name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pending Tasks Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4C4A8]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tâches en attente ({sortedPending.length})</span>
                    </div>

                    {sortedPending.length === 0 ? (
                      <p className="text-[11px] text-ink-faint italic pl-5">Toutes les tâches sont accomplies !</p>
                    ) : (
                      <div className="space-y-1.5 pl-2 max-h-[220px] overflow-y-auto pr-1">
                        {sortedPending.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start justify-between gap-2 p-2.5 bg-[#1e1e1e] rounded-xl border border-line/80 hover:border-[#D4C4A8]/40 transition-all text-xs"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                {getPriorityBadge(task.priority)}
                                <span className="font-medium text-[#f2ede4]">{task.description}</span>
                              </div>
                              {task.lead && (
                                <div className="text-[10px] text-ink-soft">
                                  Lead associable: <span className="text-[#D4C4A8]">{task.lead.company_name}</span>
                                </div>
                              )}
                            </div>

                            {task.due_date && (
                              <div className="text-right shrink-0">
                                <div className="text-[10px] text-ink-soft flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#D4C4A8]" />
                                  <span>{new Date(task.due_date).toLocaleDateString('fr-FR')}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
