type EventParams=Record<string,string|number|boolean>;
declare global {interface Window {dataLayer:unknown[];gtag?:(...args:unknown[])=>void}}
let enabled=false;
export function initializeAnalytics(id:string){if(enabled||!/^G-[A-Z0-9]+$/.test(id))return;enabled=true;window.dataLayer=window.dataLayer||[];window.gtag=(...args)=>window.dataLayer.push(args);window.gtag('js',new Date());window.gtag('config',id,{send_page_view:false});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(script);track('page_view',{page_title:document.title,page_path:window.location.pathname})}
export function track(event:string,params:EventParams={}){if(!enabled)return;const safe:EventParams={};for(const key of ['source','occasion','ease_rating','page_title','page_path'])if(key in params)safe[key]=params[key];window.gtag?.('event',event,safe)}
