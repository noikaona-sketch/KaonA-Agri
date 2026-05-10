'use client';

import { useMemo, useState } from 'react';

import { useEffectiveRole } from '@/providers/auth-provider';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type FlowStep = 'details' | 'gps' | 'review' | 'submitted';

type FlowTimelineItem = {
  id: string;
  plotName: string;
  areaRai: string;
  locationLabel: string;
  submittedAt: string;
  status: 'submitted' | 'under_review' | 'approved';
};

const FLOW_STEPS: Array<{ key: Exclude<FlowStep, 'submitted'>; title: string; subtitle: string }> = [
  { key: 'details', title: '1. Plot details', subtitle: 'Enter plot name and area' },
  { key: 'gps', title: '2. GPS capture', subtitle: 'Confirm map pin and accuracy' },
  { key: 'review', title: '3. Review & submit', subtitle: 'Double-check and submit request' },
];

export function PlotRegistrationScreen() {
  const effectiveRole = useEffectiveRole();

  const [currentStep, setCurrentStep] = useState<FlowStep>('details');
  const [plotName, setPlotName] = useState('North paddy section');
  const [areaRai, setAreaRai] = useState('8.50');
  const [locationLabel, setLocationLabel] = useState('14.291039, 100.612951 (±7m)');
  const [timeline, setTimeline] = useState<FlowTimelineItem[]>([
    {
      id: 'PR-2026-019',
      plotName: 'Canal edge plot',
      areaRai: '5.75',
      locationLabel: '14.288830, 100.618230 (±9m)',
      submittedAt: 'May 08, 2026 · 10:32',
      status: 'under_review',
    },
  ]);

  const canGoNext = useMemo(() => {
    if (currentStep === 'details') return Boolean(plotName.trim()) && Number(areaRai) > 0;
    if (currentStep === 'gps') return Boolean(locationLabel.trim());
    if (currentStep === 'review') return true;
    return false;
  }, [areaRai, currentStep, locationLabel, plotName]);

  function goNext() {
    if (currentStep === 'details') return setCurrentStep('gps');
    if (currentStep === 'gps') return setCurrentStep('review');
    if (currentStep === 'review') {
      setTimeline((previous) => [
        {
          id: `PR-2026-0${previous.length + 20}`,
          plotName,
          areaRai,
          locationLabel,
          submittedAt: new Date().toLocaleString(),
          status: 'submitted',
        },
        ...previous,
      ]);
      setCurrentStep('submitted');
    }
  }

  function goBack() {
    if (currentStep === 'gps') return setCurrentStep('details');
    if (currentStep === 'review') return setCurrentStep('gps');
    if (currentStep === 'submitted') return setCurrentStep('details');
  }

  return (
    <MobileAppShell title="Plot registration" subtitle="UX flow prototype (UI only)" roleBadge={effectiveRole ?? 'farmer'}>
      <SectionHeader title="Registration flow" subtitle="Issue #114 · No backend write" />
      {FLOW_STEPS.map((step) => {
        const isCurrent = step.key === currentStep;
        const isComplete =
          (step.key === 'details' && ['gps', 'review', 'submitted'].includes(currentStep)) ||
          (step.key === 'gps' && ['review', 'submitted'].includes(currentStep)) ||
          (step.key === 'review' && currentStep === 'submitted');

        return <InfoCard key={step.key} title={step.title} subtitle={step.subtitle} meta={<StatusChip status={isCurrent ? 'under_review' : isComplete ? 'approved' : 'draft'} />} />;
      })}

      {currentStep === 'details' ? (
        <InfoCard
          title="Step 1: Enter plot details"
          subtitle="Collect the basic information first."
          meta={
            <div>
              <label>
                Plot name
                <input value={plotName} onChange={(event) => setPlotName(event.target.value)} />
              </label>
              <label>
                Area (rai)
                <input type="number" min="0" step="0.01" value={areaRai} onChange={(event) => setAreaRai(event.target.value)} />
              </label>
            </div>
          }
        />
      ) : null}

      {currentStep === 'gps' ? (
        <InfoCard
          title="Step 2: Capture GPS"
          subtitle="Simulated map and GPS evidence confirmation."
          meta={
            <div>
              <p>Map preview placeholder: user drops pin inside farm boundary.</p>
              <label>
                GPS result
                <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} />
              </label>
            </div>
          }
        />
      ) : null}

      {currentStep === 'review' ? (
        <InfoCard
          title="Step 3: Review"
          subtitle={`Name: ${plotName} · Area: ${areaRai} rai`}
          meta={<p>Location: {locationLabel}</p>}
        />
      ) : null}

      {currentStep === 'submitted' ? <InfoCard title="Submitted" subtitle="Plot registration request sent for review." meta={<StatusChip status="submitted" />} /> : null}

      <div>
        {currentStep !== 'details' ? (
          <UIButton type="button" onClick={goBack}>
            Back
          </UIButton>
        ) : null}{' '}
        <UIButton type="button" onClick={goNext} disabled={!canGoNext}>
          {currentStep === 'review' ? 'Submit request' : currentStep === 'submitted' ? 'Start new draft' : 'Next'}
        </UIButton>
      </div>

      <SectionHeader title="Recent requests (mock)" subtitle="Shows what members see after submitting" />
      {timeline.map((item) => (
        <InfoCard
          key={item.id}
          title={`${item.plotName} · ${item.areaRai} rai`}
          subtitle={`${item.locationLabel} · ${item.submittedAt}`}
          meta={<StatusChip status={item.status} />}
        />
      ))}
    </MobileAppShell>
  );
}
