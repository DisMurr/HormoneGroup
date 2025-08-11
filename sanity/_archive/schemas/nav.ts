import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'nav',
  title: 'Navigation',
  type: 'document',
  fields: [
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string' },
            { name: 'href', type: 'string', description: 'Internal path or external URL' },
          ],
        },
      ],
    }),
  ],
})
