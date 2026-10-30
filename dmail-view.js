(() => {
  'use strict';
  function create({ event, chapter, language, prompt, label, normalize, onSend, onContinue, hint }) {
    const model = window.DmailCore, p = model.plan(event), chinese = language === 'zh-CN', pun = event.id === '8:45';
    const element = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node; };
    const box = (node, name) => { const b = p.native.boxes[name]; Object.assign(node.style, ...Object.entries(b).map(([key, value]) => ({[key]:value+'%'}))); };
    const root = element('div', 'dmail-scroll'); root.tabIndex=0; root.setAttribute('aria-label',chinese?'邮件编辑与全文':'メール編集と全文');
    const layout = element('div', 'dmail-layout'); root.append(layout);
    const phone = element('div', 'dmail-phone'); phone.lang=language; phone.setAttribute('aria-label',chinese?'原作 D-Mail 编辑器':'Dメール編集'); phone.style.aspectRatio=p.native.aspectRatioFitter.m_AspectRatio;
    const art = element('img', 'dmail-phone-art'); art.src = p.native.background.src; art.alt = ''; art.style.objectFit=p.native.preserveAspect?'contain':'fill'; phone.append(art);
    const inputs = {}, sources = {time:'TimeDropdown',to:'ToDropdown',at:'AtDropdown',what:'MessageDropdown'};
    const labels = chinese?{time:'发送时刻',to:'收件人',at:'地点',what:'物品'}:{time:'送信時刻',to:'宛先',at:'場所',what:'本文'};
    for (const key of ['time','to','at','what']) {
      if (!p.fields[key]) continue;
      const select = element('select', 'dmail-input dmail-'+key); select.id='answer-'+key; select.name=key;
      select.setAttribute('aria-label',labels[key]);
      for (const value of chapter.options[sources[key]] || []) {
        const option = document.createElement('option'); option.value=value;
        const bilingual=chinese&&pun&&key==='what'&&['なかま','ともだち'].includes(value);
        option.textContent=value ? (bilingual ? value+'（'+label(key,value)+'）' : label(key,value)) : chinese ? '请选择' : '選択'; select.append(option);
      }
      box(select, sources[key]); inputs[key]=select; phone.append(select);
    }
    if (!p.fields.to) { const recipient = element('span','dmail-fixed-to',label('to',p.fixedTo)); recipient.id='dmail-recipient'; box(recipient,'ToText'); phone.append(recipient); }
    if (p.fields.at) { const at = element('span','dmail-at-label','at'); box(at,'AtText'); phone.append(at); }
    const commands = element('div','dmail-commands'); commands.setAttribute('aria-label',chinese?'当前邮件指令':'メールの指示'); box(commands,'MessageText');
    for (const command of p.native.commands) {
      const row = element('span', command.active ? 'dmail-command active' : 'dmail-command inactive');
      row.dataset.active=String(command.active); row.lang=language;
      const meaning=command.text.endsWith('な') ? '别做' : '做';
      row.append(element('span','',chinese&&!pun ? meaning : command.text));
      if(chinese&&pun)row.append(element('small','','（'+meaning+'）'));
      commands.append(row);
    }
    phone.append(commands);
    const phrase = element('div','dmail-inline-phrase'); phrase.lang='ja'; phrase.id='dmail-inline-phrase'; phrase.hidden=chinese; phone.append(phrase);
    const send = element('button','dmail-send',chinese ? '发送' : '送信'); send.type='button'; send.id='dmail-send'; box(send,'SendButton'); phone.append(send);
    layout.append(phone);
    const side = element('section','dmail-reading'); side.lang=language;
    const copy=element('div','dmail-copy');copy.tabIndex=0;copy.setAttribute('aria-label',chinese?'邮件全文与说明':'メール全文と説明');
    side.append(copy);copy.append(element('p','dmail-prompt',prompt));
    const preview = element('section','dmail-preview'); preview.setAttribute('aria-label',chinese?'完整邮件':'メール全文');
    preview.append(element('h3','',chinese ? '邮件全文' : '送信メール'));
    const meta = element('dl','dmail-meta'); const metaValues={};
    for (const [key, title] of [['time',chinese?'时间':'時間'],['to',chinese?'收件人':'宛先'],['subject',chinese?'主题':'件名']]) {
      const value=element('dd','');metaValues[key]=value;meta.append(element('dt','',title),value);
    }
    const payload=element('pre','dmail-payload');payload.id='dmail-payload';payload.lang=chinese&&!pun?'zh-CN':'ja';
    metaValues.to.lang=language;
    preview.append(meta,payload);
    const gloss=element('div','dmail-gloss');gloss.id='dmail-gloss';gloss.hidden=!chinese||!pun;preview.append(gloss);
    const original=element('details','dmail-original'), originalBody=element('pre','dmail-payload');originalBody.lang='ja';
    if(chinese&&!pun){original.append(element('summary','','查看原文'),originalBody);preview.append(original);}
    copy.append(preview);
    const feedback=element('p','answer-feedback');feedback.id='dmail-feedback';feedback.setAttribute('role','status');
    const actions=element('div','event-actions');
    const skip=element('button','', chinese?'跳过题目 →':'問題をスキップ →');skip.type='button';skip.addEventListener('click',onContinue);
    let hintLevel=0;
    const hints=[
      '这封邮件没有空格。试着改变断句的位置，想想怎样才能让自己不遇见冈部。',
      '词语对照：なかま = 伙伴；つくるな = 别结交。还记得电器店中松吗？它写作 なかまつ，而 くるな 表示“别来”。',
      'なかまつ｜くるな → 别来中松\nなかま｜つくるな → 别交伙伴\n两种断句使用的是同一串文字。'
    ];
    const showHint=element('button','inline-link',chinese?'提示':'ヒント');showHint.type='button';showHint.addEventListener('click',()=>{
      if(chinese&&pun){feedback.textContent=hints[hintLevel]??hint();hintLevel=Math.min(hintLevel+1,hints.length);showHint.textContent=hintLevel===hints.length?'显示答案':'进一步提示';}
      else feedback.textContent=hint();
    });
    actions.append(skip,showHint);copy.append(feedback);side.append(actions);layout.append(side);
    const read = () => model.values(event,Object.fromEntries(Object.entries(inputs).map(([key,node])=>[key,node.value])));
    function update() {
      const values=read(), d=model.draft(event,values);
      metaValues.time.textContent=d.time || '—';metaValues.to.textContent=d.to ? label('to',d.to) : '—';metaValues.subject.textContent='';
      phrase.textContent=d.phrase;originalBody.textContent=d.body;
      const noun=values.what ? label('what',values.what) : '…';
      let meaning=d.command.endsWith('な') ? '别做'+noun : '做出'+noun;
      if (d.command==='つくるな' && values.what==='なかま') meaning='别交伙伴';
      if (d.command==='つくるな' && values.what==='ともだち') meaning='别交朋友';
      const translated=(p.fields.at ? '在'+(values.at?label('at',values.at):'…')+'，\n' : '')+meaning;
      payload.textContent=chinese&&!pun?translated:d.body;
      gloss.hidden=!(chinese&&pun&&values.what==='なかま');
      gloss.textContent=gloss.hidden?'':'直译：别交伙伴\n断句双关：别来中松';
    }
    for (const input of Object.values(inputs)) input.addEventListener('change',()=>{input.removeAttribute('aria-invalid');delete input.dataset.correct;feedback.textContent='';update();});
    send.addEventListener('click',()=>{
      const values=read(), checks=model.fieldsCorrect(event,values,normalize);
      for (const [key,input] of Object.entries(inputs)) { input.dataset.correct=String(checks[key]); input.setAttribute('aria-invalid',String(!checks[key])); }
      onSend(values,feedback);
    });
    update(); return root;
  }
  window.DmailView={create};
})();
