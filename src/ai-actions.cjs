const SCHEMAS=[
 {name:'save_note',description:'Предложить сохранить текст как заметку к текущей странице.',properties:{text:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['text']},
 {name:'search_tabs',description:'Предложить поиск среди уже открытых вкладок.',properties:{query:{type:'string'}},required:['query']},
 {name:'switch_workspace',description:'Предложить переключение в существующий workspace по точному названию.',properties:{name:{type:'string'}},required:['name']},
 {name:'sleep_tab',description:'Предложить усыпить неактивную вкладку с точно указанным URL. Активные вкладки и формы защищены.',properties:{url:{type:'string'}},required:['url']}
].map(s=>({type:'function',function:{name:s.name,description:s.description+' Действие выполняется только после нажатия пользователем кнопки.',parameters:{type:'object',properties:s.properties,required:s.required,additionalProperties:false}}}));
function action(name,args){if(!args||typeof args!=='object')return null;
 if(name==='save_note'&&typeof args.text==='string'&&args.text.trim())return{kind:name,title:'Сохранить заметку',args:{text:args.text.slice(0,20000),tags:Array.isArray(args.tags)?args.tags.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,32)):[]}};
 if(name==='search_tabs'&&typeof args.query==='string')return{kind:name,title:'Найти вкладки: '+args.query.slice(0,50),args:{query:args.query.slice(0,300)}};
 if(name==='switch_workspace'&&typeof args.name==='string')return{kind:name,title:'Переключить workspace: '+args.name.slice(0,48),args:{name:args.name.slice(0,48)}};
 if(name==='sleep_tab'&&typeof args.url==='string'){try{const url=new URL(args.url);if(['http:','https:'].includes(url.protocol))return{kind:name,title:'Усыпить вкладку: '+url.hostname,args:{url:url.href}};}catch{}}
 return null;
}
module.exports={SCHEMAS,action};
