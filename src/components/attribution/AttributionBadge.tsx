import React from 'react';
import { AttributionMark, AttributionMarkProps } from './AttributionMark';

export const AttributionBadge: React.FC<AttributionMarkProps> = (props) => {
  return <AttributionMark {...props} />;
};

export default AttributionBadge;
