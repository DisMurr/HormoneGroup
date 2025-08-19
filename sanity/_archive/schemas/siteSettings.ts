import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', type: 'text' }),
    defineField({ name: 'logo', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'ogImage', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'email', type: 'string' }),
    defineField({ name: 'phone', type: 'string' }),
    defineField({
      name: 'nav',
      type: 'reference',
      to: [{ type: 'nav' }],
    }),
    defineField({
      name: 'footer',
      type: 'reference',
      to: [{ type: 'footer' }],
    }),
  ],
})
