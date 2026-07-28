import type { ReactNode } from 'react';

export function StudioBackground(): ReactNode {
  return (
    <div className="nova-bg">
      <div className="nova-bg__radial-light" />
      <div className="nova-bg__sphere nova-bg__sphere--1" />
      <div className="nova-bg__sphere nova-bg__sphere--2" />
      <div className="nova-bg__sphere nova-bg__sphere--3" />
      <div className="nova-bg__sphere nova-bg__sphere--4" />
      <div className="nova-bg__sphere nova-bg__sphere--5" />
      <div className="noise absolute inset-0" aria-hidden />
    </div>
  );
}
