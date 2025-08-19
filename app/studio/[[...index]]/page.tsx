'use client'
import { NextStudio } from 'next-sanity/studio'
// Import archived config (types may mismatch, cast to any)
// @ts-ignore
import configFile from '../../../sanity/sanity.config'
const config: any = configFile

export default function StudioPage() {
  return <NextStudio config={config} />
}
