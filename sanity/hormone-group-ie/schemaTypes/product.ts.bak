import {defineType, defineField} from 'sanity'
export default defineType({
  name:'product',
  title:'Product',
  type:'document',
  fields:[
    defineField({name:'title', type:'string', validation:r=>r.required()}),
    defineField({name:'slug', type:'slug', options:{source:'title'}, validation:r=>r.required()}),
    defineField({name:'category', type:'reference', to:[{type:'category'}]}),
    defineField({name:'priceEUR', title:'Price (€)', type:'number', validation:r=>r.required().min(0)}),
    defineField({name:'turnaround', type:'string'}),
    defineField({name:'sampleType', type:'string', options:{list:['DBS','Serum','Saliva']}}),
    defineField({name:'fasting', type:'boolean'}),
    defineField({name:'timing', type:'string'}),
    defineField({name:'markers', type:'array', of:[{type:'string'}]}),
    defineField({name:'whyItMatters', type:'array', of:[{type:'string'}]}),
    defineField({name:'symptoms', type:'array', of:[{type:'string'}]}),
    defineField({name:'whatYouGet', type:'array', of:[{type:'string'}]}),
    defineField({name:'flags', type:'object', fields:[defineField({name:'subscription', type:'boolean'})]}),
  ],
})
