import React from 'react';
import type { ActivityRecord } from '../../../lib/soroban/types';
import {
  getActivityMeta,
  formatActivityLine,
} from '../../../lib/activity/activityLabels';
import { formatLedgerTimestamp } from '../../../lib/format';
import './ActivityFeed.css';

interface ActivityFeedItemProps {
  record: ActivityRecord;
  campaignId?: bigint;
}

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  record,
  campaignId,
}) => {
  const tag = record.action_type.tag;
  const meta = getActivityMeta(tag);
  const line = formatActivityLine(tag, record.actor, campaignId);
  const time = formatLedgerTimestamp(record.timestamp);

  return (
    <li className="activity-item" aria-label={line}>
      <span className="activity-item__icon" aria-hidden="true">
        {meta.icon}
      </span>
      <div className="activity-item__body">
        <span className={`activity-tag ${meta.colorClass}`}>{meta.label}</span>
        <p className="activity-item__line">{line}</p>
        <time
          className="activity-item__time"
          dateTime={new Date(Number(record.timestamp) * 1000).toISOString()}
        >
          {time}
        </time>
      </div>
    </li>
  );
};
