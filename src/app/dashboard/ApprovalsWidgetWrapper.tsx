'use client'

import dynamic from 'next/dynamic'

const ApprovalsWidget = dynamic(() => import('./ApprovalsWidget').then(mod => mod.ApprovalsWidget), {
  ssr: false,
  loading: () => null
})

export function ApprovalsWidgetWrapper(props: any) {
  return <ApprovalsWidget {...props} />
}
