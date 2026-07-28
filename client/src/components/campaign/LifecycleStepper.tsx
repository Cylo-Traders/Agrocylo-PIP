import { LIFECYCLE_STEPS, lifecycleStepIndex } from '../../lib/campaignStatus';
import type { CampaignStatusTag } from '../../lib/soroban/types';

const DERAILED_STATUSES: CampaignStatusTag[] = [
  'Disputed',
  'Resolved',
  'Failed',
];

export function LifecycleStepper({ status }: { status: CampaignStatusTag }) {
  const currentIndex = lifecycleStepIndex(status);
  const derailed = DERAILED_STATUSES.includes(status);

  return (
    <div>
      <ol className="flex items-center" aria-label="Campaign lifecycle">
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCurrent = !derailed && index === currentIndex;
          const isPassed = index < currentIndex;
          const isLast = index === LIFECYCLE_STEPS.length - 1;

          const circleClass = isPassed
            ? 'border-leaf-700 bg-leaf-700 text-white'
            : isCurrent
              ? 'border-leaf-700 bg-white text-leaf-700'
              : 'border-soil-300 bg-white text-soil-600';

          return (
            <li
              key={step.key}
              className="flex flex-1 items-center last:flex-none"
            >
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${circleClass}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isPassed ? (
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`text-caption font-medium ${isCurrent ? 'text-leaf-700' : isPassed ? 'text-soil-700' : 'text-soil-600'}`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${index < currentIndex ? 'bg-leaf-700' : 'bg-soil-200'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      {derailed && (
        <p className="mt-3 text-body-sm text-soil-600">
          This campaign left the standard funding path —{' '}
          <span className="font-semibold">{status}</span>. See the dispute
          section below for details.
        </p>
      )}
    </div>
  );
}
