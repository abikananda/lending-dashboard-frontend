import { AsyncPipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { catchError, combineLatest, map, of, shareReplay } from 'rxjs';
import { ApiService, Loan, Summary } from '../core/api.service';

interface Metric { label:string; value:number; icon:string; tone:string; money?:boolean; note:string; }

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DecimalPipe, NgxChartsModule],
  template: `
    @if(vm$|async; as vm){
      <header class="page-head">
        <div><span class="eyebrow">LENDING COMMAND CENTRE</span><h1>Portfolio Overview</h1><p>Performance, repayments and risk—all in one view.</p></div>
        <div class="health-pill"><span></span><div><small>Portfolio health</small><strong>{{vm.healthLabel}}</strong></div></div>
      </header>

      <section class="metrics">
        @for(m of vm.metrics;track m.label){
          <article class="metric-card" [class]="'metric-card '+m.tone">
            <div class="metric-top"><span class="metric-icon">{{m.icon}}</span><span class="trend">{{m.note}}</span></div>
            <span class="metric-label">{{m.label}}</span>
            <strong>{{m.money?(m.value|currency:'INR':'symbol':'1.0-0'):m.value}}</strong>
            <div class="metric-line"><i></i></div>
          </article>
        }
      </section>

      <section class="charts-grid">
        <article class="panel status-panel">
          <div class="panel-head"><div><span class="section-tag purple">DISTRIBUTION</span><h3>Loan status</h3></div><span class="total-badge">{{vm.totalLoans}} loans</span></div>
          <div class="donut-wrap">
            <ngx-charts-pie-chart [results]="vm.loanStatus" [scheme]="statusScheme" [doughnut]="true" [arcWidth]="0.28" [legend]="false" [labels]="false" [animations]="true"></ngx-charts-pie-chart>
            <div class="donut-center"><strong>{{vm.activeRate|number:'1.0-0'}}%</strong><small>active</small></div>
          </div>
          <div class="legend-row">@for(item of vm.loanStatus;track item.name){<div><i [style.background]="statusColor(item.name)"></i><span>{{item.name}}</span><strong>{{item.value}}</strong></div>}</div>
        </article>

        <article class="panel amount-panel">
          <div class="panel-head"><div><span class="section-tag blue">CAPITAL POSITION</span><h3>Investment by status</h3></div></div>
          <div class="chart-area bar-chart"><ngx-charts-bar-vertical [results]="vm.amountStatus" [scheme]="amountScheme" [gradient]="true" [xAxis]="true" [yAxis]="true" [showXAxisLabel]="false" [showYAxisLabel]="false" [roundEdges]="true" [animations]="true"></ngx-charts-bar-vertical></div>
        </article>

        <article class="panel wide trend-panel">
          <div class="panel-head"><div><span class="section-tag teal">12-MONTH ACTIVITY</span><h3>Monthly lending trend</h3></div><div class="mini-legend"><span><i class="total"></i>Total</span><span><i class="active"></i>Active</span><span><i class="closed"></i>Closed</span></div></div>
          <div class="chart-area line-chart"><ngx-charts-line-chart [results]="vm.monthlyTrend" [scheme]="trendScheme" [legend]="false" [xAxis]="true" [yAxis]="true" [autoScale]="true" [timeline]="false" [animations]="true" [roundDomains]="true"></ngx-charts-line-chart></div>
        </article>

        <article class="panel repayment-panel">
          <div class="panel-head"><div><span class="section-tag amber">CASH RECOVERY</span><h3>Repayment progress</h3></div></div>
          <div class="progress-hero"><div class="progress-ring" [style.--progress]="vm.repaymentRate+'%'" ><div><strong>{{vm.repaymentRate|number:'1.0-0'}}%</strong><small>received</small></div></div></div>
          <div class="cash-row"><div><span>Received</span><strong>{{vm.summary.totalAmountReceived|currency:'INR':'symbol':'1.0-0'}}</strong></div><div><span>Outstanding</span><strong>{{vm.summary.outstandingPrincipal|currency:'INR':'symbol':'1.0-0'}}</strong></div></div>
        </article>
      </section>

      <article class="panel loans-panel">
        <div class="panel-head"><div><span class="section-tag red">LIVE PORTFOLIO</span><h3>Recent loans</h3></div><span class="total-badge">Updated now</span></div>
        <div class="table-responsive"><table class="table"><thead><tr><th>Borrower</th><th>Scheme</th><th>Invested</th><th>Received</th><th>Outstanding</th><th>EMI</th><th>DPD</th><th>Status</th></tr></thead><tbody>
          @for(l of vm.loans.slice(0,8);track l.schemeId){<tr><td><div class="borrower"><span>{{initials(l.borrowerName)}}</span><strong>{{l.borrowerName||'Unknown borrower'}}</strong></div></td><td class="scheme">{{l.schemeId}}</td><td>{{l.investedAmount|currency:'INR':'symbol':'1.0-0'}}</td><td class="positive">{{l.amountReceived|currency:'INR':'symbol':'1.0-0'}}</td><td>{{l.outstandingPrincipal|currency:'INR':'symbol':'1.0-0'}}</td><td>{{l.principalEmi|currency:'INR':'symbol':'1.0-0'}}</td><td><span class="dpd" [class.risk]="l.dpd>7">{{l.dpd}}</span></td><td><span class="status" [class.active]="l.loanStatus==='ACTIVE'" [class.npa]="l.npa">{{l.npa?'NPA':l.loanStatus}}</span></td></tr>}
          @empty{<tr><td colspan="8"><div class="empty"><span>◫</span><strong>No lending data yet</strong><p>Upload your LenDenClub report to unlock portfolio insights.</p></div></td></tr>}
        </tbody></table></div>
      </article>
    } @else { <div class="loading"><span></span><p>Preparing your portfolio…</p></div> }
  `,
  styles: [`
    :host{display:block;max-width:1500px;margin:auto}.page-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}.eyebrow{font-size:10px;letter-spacing:1.8px;font-weight:850;color:#4968e8}.page-head h1{font-size:32px;letter-spacing:-1.2px;margin:7px 0 4px;color:#0c1938}.page-head p{margin:0;color:#748096}.health-pill{display:flex;gap:11px;align-items:center;background:#fff;padding:11px 17px;border-radius:14px;box-shadow:0 8px 30px rgba(26,45,85,.08)}.health-pill>span{width:10px;height:10px;border-radius:50%;background:#20bf8f;box-shadow:0 0 0 5px #d9f8ee}.health-pill div{display:grid}.health-pill small{color:#8a94a7;font-size:10px}.health-pill strong{font-size:13px;color:#17314d}.metrics{display:grid;grid-template-columns:repeat(6,minmax(150px,1fr));gap:14px;margin-bottom:18px}.metric-card{min-height:145px;border-radius:19px;padding:18px;position:relative;overflow:hidden;color:#fff;box-shadow:0 15px 32px rgba(38,63,120,.12)}.metric-card:after{content:'';position:absolute;width:100px;height:100px;border:18px solid rgba(255,255,255,.09);border-radius:50%;right:-38px;bottom:-44px}.metric-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.metric-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.18);font-size:16px}.trend{font-size:9px;background:rgba(255,255,255,.14);border-radius:20px;padding:4px 7px}.metric-label{display:block;font-size:11px;opacity:.8;margin-bottom:5px}.metric-card>strong{display:block;font-size:22px;letter-spacing:-.6px}.metric-line{height:3px;background:rgba(255,255,255,.14);border-radius:4px;margin-top:17px}.metric-line i{display:block;width:68%;height:100%;background:rgba(255,255,255,.7);border-radius:4px}.tone-blue{background:linear-gradient(135deg,#315de3,#6a7ff1)}.tone-teal{background:linear-gradient(135deg,#049b8a,#32c9a8)}.tone-violet{background:linear-gradient(135deg,#6d3fd6,#a86fe7)}.tone-cyan{background:linear-gradient(135deg,#087fa9,#25b9d4)}.tone-amber{background:linear-gradient(135deg,#df8d13,#f5b940)}.tone-red{background:linear-gradient(135deg,#d94a61,#f0767b)}.charts-grid{display:grid;grid-template-columns:1fr 1.35fr .75fr;gap:18px;margin-bottom:18px}.panel{background:#fff;border:1px solid #e9edf5;border-radius:20px;padding:21px;box-shadow:0 9px 30px rgba(19,42,86,.055);min-width:0}.wide{grid-column:span 2}.panel-head{display:flex;justify-content:space-between;align-items:flex-start}.panel-head h3{font-size:17px;margin:7px 0 0;color:#14213d;letter-spacing:-.3px}.section-tag{font-size:9px;font-weight:850;letter-spacing:1.2px}.purple{color:#8254d6}.blue{color:#3a66dc}.teal{color:#08a48d}.amber{color:#d38716}.red{color:#d84a62}.total-badge{font-size:10px;background:#f3f6fb;color:#6d788a;padding:6px 9px;border-radius:8px}.donut-wrap{height:225px;position:relative}.donut-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center;pointer-events:none}.donut-center strong{font-size:26px;color:#17233e}.donut-center small{color:#8690a2}.legend-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.legend-row>div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px;font-size:10px;color:#7a8597}.legend-row i{width:7px;height:7px;border-radius:50%}.legend-row strong{color:#26334d}.chart-area{height:250px;margin-top:12px}.line-chart{height:290px}.mini-legend{display:flex;gap:13px;color:#7d8798;font-size:10px}.mini-legend span{display:flex;align-items:center;gap:5px}.mini-legend i{width:8px;height:8px;border-radius:50%}.mini-legend .total{background:#4267e8}.mini-legend .active{background:#20b895}.mini-legend .closed{background:#9b6add}.progress-hero{display:grid;place-items:center;height:225px}.progress-ring{--progress:0%;width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#f0a42a var(--progress),#eef1f7 0);position:relative}.progress-ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.progress-ring div{display:grid;text-align:center;z-index:1}.progress-ring strong{font-size:27px;color:#15213b}.progress-ring small{color:#8a94a5}.cash-row{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #eef1f5;padding-top:15px;gap:12px}.cash-row div{display:grid}.cash-row span{font-size:10px;color:#8a94a4}.cash-row strong{font-size:13px;color:#263551;margin-top:4px}.loans-panel{padding:22px}.table{margin:15px 0 0}.table th{font-size:9px;letter-spacing:.7px;text-transform:uppercase;color:#8c96a7;border-bottom-color:#e9edf4;padding:12px}.table td{font-size:12px;color:#465269;border-bottom-color:#f0f2f6;padding:13px 12px}.borrower{display:flex;align-items:center;gap:9px}.borrower>span{width:31px;height:31px;border-radius:9px;background:#eaf0ff;color:#3a60d3;display:grid;place-items:center;font-weight:800;font-size:10px}.borrower strong{color:#1d2b45;white-space:nowrap}.scheme{font-family:monospace;color:#64708a!important}.positive{color:#079d76!important;font-weight:700}.dpd{display:inline-grid;place-items:center;min-width:25px;height:25px;border-radius:7px;background:#eef8f5;color:#159473;font-weight:750}.dpd.risk{background:#fff0ee;color:#d84a43}.status{font-size:9px;font-weight:850;letter-spacing:.5px;padding:6px 9px;border-radius:20px;background:#eef0f5;color:#687386}.status.active{background:#dff8ef;color:#07835f}.status.npa{background:#ffe5e7;color:#c73345}.empty{text-align:center;padding:35px}.empty span{font-size:32px;color:#9aa6b9}.empty strong{display:block;color:#35435b;margin:8px}.empty p{color:#8b95a5}.loading{height:60vh;display:grid;place-content:center;text-align:center;color:#718096}.loading span{width:34px;height:34px;border:3px solid #dce4f5;border-top-color:#4165e5;border-radius:50%;animation:spin .8s linear infinite;margin:auto}@keyframes spin{to{transform:rotate(360deg)}}:host ::ng-deep .ngx-charts text{fill:#7b8799!important;font-size:10px}:host ::ng-deep .gridline-path{stroke:#edf0f5!important}@media(max-width:1250px){.metrics{grid-template-columns:repeat(3,1fr)}.charts-grid{grid-template-columns:1fr 1fr}.wide{grid-column:span 2}.repayment-panel{grid-column:span 2}}@media(max-width:760px){.page-head{align-items:flex-start}.health-pill{display:none}.metrics{grid-template-columns:repeat(2,1fr)}.charts-grid{grid-template-columns:1fr}.wide,.repayment-panel{grid-column:auto}.mini-legend{display:none}.panel{padding:16px}}@media(max-width:430px){.metrics{grid-template-columns:1fr}.page-head h1{font-size:27px}}
  `]
})
export class DashboardComponent {
  private readonly api=inject(ApiService);
  readonly statusScheme={name:'status',selectable:true,group:ScaleType.Ordinal,domain:['#27bf91','#9b69dd','#ed5c68']};
  readonly amountScheme={name:'amount',selectable:true,group:ScaleType.Ordinal,domain:['#4167e8','#21b995','#ec5a68']};
  readonly trendScheme={name:'trend',selectable:true,group:ScaleType.Ordinal,domain:['#4267e8','#20b895','#9b6add']};
  readonly vm$=combineLatest({summary:this.api.summary().pipe(catchError(()=>of({totalAmountLent:0,totalAmountReceived:0,outstandingPrincipal:0,activeLoans:0,closedLoans:0,npaLoans:0}))),loans:this.api.loans().pipe(catchError(()=>of([] as Loan[]))) }).pipe(map(({summary,loans})=>this.buildView(summary,loans)),shareReplay(1));
  private buildView(summary:Summary,loans:Loan[]){const totalLoans=summary.activeLoans+summary.closedLoans;const activeAmount=this.sum(loans.filter(x=>x.loanStatus==='ACTIVE'),x=>x.outstandingPrincipal);const closedAmount=this.sum(loans.filter(x=>x.loanStatus==='CLOSED'),x=>x.investedAmount);const npaAmount=this.sum(loans.filter(x=>x.npa),x=>x.outstandingPrincipal);const repaymentBase=summary.totalAmountReceived+summary.outstandingPrincipal;const repaymentRate=repaymentBase?summary.totalAmountReceived*100/repaymentBase:0;const activeRate=totalLoans?summary.activeLoans*100/totalLoans:0;return{summary,loans,totalLoans,repaymentRate,activeRate,healthLabel:summary.npaLoans===0?'Healthy':summary.npaLoans<3?'Watchlist':'Needs attention',metrics:[{label:'Total amount lent',value:summary.totalAmountLent,money:true,icon:'₹',tone:'tone-blue',note:'CAPITAL'},{label:'Total received',value:summary.totalAmountReceived,money:true,icon:'↙',tone:'tone-teal',note:`${repaymentRate.toFixed(0)}% RECOVERED`},{label:'Outstanding',value:summary.outstandingPrincipal,money:true,icon:'◷',tone:'tone-violet',note:'RECEIVABLE'},{label:'Active loans',value:summary.activeLoans,icon:'●',tone:'tone-cyan',note:`${activeRate.toFixed(0)}% OF TOTAL`},{label:'Closed loans',value:summary.closedLoans,icon:'✓',tone:'tone-amber',note:'COMPLETED'},{label:'NPA loans',value:summary.npaLoans,icon:'!',tone:'tone-red',note:summary.npaLoans?'REVIEW':'ALL CLEAR'}] as Metric[],loanStatus:[{name:'Active',value:summary.activeLoans},{name:'Closed',value:summary.closedLoans},{name:'NPA',value:summary.npaLoans}],amountStatus:[{name:'Active',value:activeAmount},{name:'Closed',value:closedAmount},{name:'NPA',value:npaAmount}],monthlyTrend:this.monthly(loans)};}
  private monthly(loans:Loan[]){const now=new Date();const months=Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-11+i,1);return{key:`${d.getFullYear()}-${d.getMonth()}`,label:d.toLocaleDateString('en-IN',{month:'short'})};});const series=(name:string,test:(l:Loan)=>boolean)=>({name,series:months.map(m=>({name:m.label,value:loans.filter(l=>{const d=new Date(l.investmentDate);return test(l)&&`${d.getFullYear()}-${d.getMonth()}`===m.key;}).length}))});return[series('Total',()=>true),series('Active',l=>l.loanStatus==='ACTIVE'),series('Closed',l=>l.loanStatus==='CLOSED')];}
  private sum(items:Loan[],pick:(l:Loan)=>number){return items.reduce((total,item)=>total+(pick(item)||0),0);}
  statusColor(name:string){return name==='Active'?'#27bf91':name==='Closed'?'#9b69dd':'#ed5c68';}
  initials(name:string){return(name||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();}
}
