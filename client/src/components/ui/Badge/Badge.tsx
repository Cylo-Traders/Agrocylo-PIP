import React from 'react';
import './Badge.css';

/**
 * Valid states representing a Campaign's lifecycle status.
 */
export type CampaignStatus =
  | 'Active'
  | 'Funding'
  | 'Funded'
  | 'InProduction'
  | 'Harvested'
  | 'Disputed'
  | 'Resolved'
  | 'Settled'
  | 'Failed';

/**
 * Props for the Badge component.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Specifically formats the badge to display a CampaignStatus value with distinct styling.
   */
  status?: CampaignStatus;
  /**
   * Generic style variant. Ignored if `status` is provided.
   * @default 'neutral'
   */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

/**
 * Badge component used to display statuses, categories, or metrics in small colored labels.
 *
 * @example
 * ```tsx
 * <Badge status="Active" />
 * <Badge variant="success">Success</Badge>
 * ```
 */
export const Badge: React.FC<BadgeProps> = ({
  status,
  variant = 'neutral',
  children,
  className = '',
  ...props
}) => {
  const isStatusBadge = !!status;

  const badgeClass = isStatusBadge
    ? `ui-badge ui-badge--status-${status.toLowerCase()}`
    : `ui-badge ui-badge--variant-${variant}`;

  return (
    <span className={`${badgeClass} ${className}`} {...props}>
      {status ? status : children}
    </span>
  );
};
