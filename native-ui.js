(() => {
  'use strict';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
  const button=(text,fn,cls)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  // Native anchors; the mail body starts lower to leave space below the subject.
  const fields={time:[.18,.214,.69,.039],from:[.18,.243,.69,.04],subject:[.18,.273,.69,.039],body:[.125,.337,.745,.274],image:[.115,.185,.764,.432]};
  function place(node,rect){const [x,y,w,h]=rect;Object.assign(node.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});return node;}
  function phone({event,display,language,clean,openImage}) {
    const ja=language==='ja',mail=event.type==='mail';
    const layout=el('div','native-phone-layout'),phone=el('div','native-phone'),art=el('img','native-phone-art');
    layout.lang=language;layout.dataset.kind=event.type;phone.style.aspectRatio=mail?'969 / 2022':'946 / 1974';
    art.src=mail?'assets/088148c32b77a47d6c4a5914.webp':'assets/e6051b2d709119880acba023.webp';art.alt='';phone.append(art);
    if(mail){
      const divider=el('div','native-mail-divider');divider.setAttribute('aria-hidden','true');phone.append(divider);
      const body=clean(display.text||'');
      for(const [key,value] of Object.entries({time:event.clock||'',from:display.from||'',subject:display.subject||'',body})){
        const node=place(el('div','native-mail-field native-mail-'+key,value),fields[key]);
        if(key==='body'){
          node.tabIndex=0;node.setAttribute('aria-label',ja?'メール本文':'邮件正文');
          node.addEventListener('keydown',ev=>{if([' ','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(ev.key))ev.stopPropagation();});
        }
        phone.append(node);
      }
    } else if(event.image){
      const image=el('img','native-attachment');image.src=event.image.src;image.alt=event.image.name||'';
      const inspect=button('',()=>openImage(event.image,ja?'添付画像':'邮件附件'),'native-attachment-button');
      inspect.setAttribute('aria-label',ja?'添付画像を拡大':'放大附件');inspect.append(image);phone.append(place(inspect,fields.image));
    }
    layout.append(phone);
    return layout;
  }
  function materials({language,openImage}) {
    const ja=language==='ja',box=el('div','original-materials');box.lang=language;
    box.append(el('p','materials-context',ja?'以下は当時の体験の記録です。この復原版では現地への移動や紙冊子の入手は不要です。':'这里保存原版线下体验的说明。本复原版可直接继续剧情，无需前往现场或领取纸质材料。'));
    const guide=el('section','materials-guide');guide.append(el('h3','',ja?'第7章：追加STORY BOOK':'第 7 章：追加 STORY BOOK'));
    guide.append(el('p','native-mail-copy',ja?'実際にカフェメイリッシュに向かい、店内に入ろう。\n店内にある金庫に「ラボに戻る」と入力して、追加STORY BOOKを入手しよう。\n\n※追加STORY BOOK入手以降は、どこで解いても問題ございません。落ち着いた場所で最後までお解きください。\nまた、カフェメイリッシュでは、謎解きコースターが付いたオリジナルドリンクもご用意しております。ぜひお立ち寄りください。':'原版要求前往 Café Mai:lish，在店内的保险箱输入“ラボに戻る”（回到研究所），领取追加 STORY BOOK。\n\n领取后可以在任何地方继续解谜。原版还介绍了店内附带解谜杯垫的原创饮品。'));
    const alternative=el('section','materials-alternative');alternative.hidden=true;
    const close=button('',()=>{alternative.hidden=true;fallback.focus();},'native-dialog-close');close.setAttribute('aria-label',ja?'代替案を閉じる':'关闭替代流程');
    const closeArt=el('img');closeArt.src='assets/cc27cde292fa0a22e8aba41a.webp';closeArt.alt='';close.append(closeArt);
    alternative.append(close,el('h4','',ja?'当時の代替手順':'原版备用流程'),el('p','native-mail-copy',ja?'XR BASE (営業時間：10:00～20:00) に向かい、XR BASE内のスタッフに「メイリッシュの金庫を開けに来た」とお伝えください。':'原版要求前往 XR BASE（当时标注营业时间为 10:00～20:00），向工作人员说明：“メイリッシュの金庫を開けに来た”（我来开 Mai:lish 的保险箱）。'));
    alternative.append(el('p','materials-context',ja?'当時の案内であり、現在の営業時間・実施状況を示すものではありません。':'这是当时的活动说明，所列营业时间和服务流程不代表当前仍然有效。'));
    const fallback=button(ja?'カフェメイリッシュが\n閉まっている場合':'Café Mai:lish 关门时',()=>{alternative.hidden=false;close.focus();},'native-blue-button');fallback.setAttribute('aria-controls','materials-alternative');alternative.id='materials-alternative';
    guide.append(fallback,alternative);box.append(guide);
    const notice=el('section','materials-notice');notice.append(el('h3','',ja?'原版のAR注意事項':'原版 AR 注意事项'));
    const image={src:'assets/ceb682c279c0680b6feca3bc.webp',name:ja?'原版のAR注意事項':'原版 AR 注意事项'};
    const inspect=button('',()=>openImage(image,image.name),'materials-notice-image'),art=el('img');art.src=image.src;art.alt=ja?'AR起動後はなるべく同じ位置に立ち止まってお楽しみください。':'原版要求启动 AR 后尽量留在原地；结束内容后可以移动并重新启动。';inspect.append(art);inspect.setAttribute('aria-label',ja?'原版の注意事項を拡大':'放大原版注意事项');
    notice.append(inspect,el('p','materials-context',ja?'原版ではARの位置ずれを避けるための案内でした。この復原版はカメラを使わず、移動による位置ずれは起きません。':'原图说明启动 AR 后移动可能导致位置异常，建议留在原地游玩；结束后可以移动，再启动下一段。本复原版使用平面舞台，这条限制仅作为原版资料保留。'));box.append(notice);return box;
  }
  window.NativeUI={phone,materials,fields};
})();
