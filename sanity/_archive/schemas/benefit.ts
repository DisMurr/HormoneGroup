import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'benefit',
  title: 'Benefit',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', type: 'text' }),
    defineField({ name: 'icon', type: 'string', description: 'Icon name or identifier' }),
  ],
})
