/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Fonctions utilitaires pour la fenetre de composition
 */

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource://gre/modules/pacomeAuthUtils.jsm");


/*
 * Teste si l'emetteur est dans le domaine melanie2
 *
 *
 */
function m2sIsEmetteurMelanie2(identite){

  try{

    m2sTrace("m2sIsEmetteurMelanie2 uid:"+identite.identityName);
    let smtpKey=identite.smtpServerKey;

    let srv=null;

    if (null!=smtpKey)
      srv=MailServices.smtp.getServerByKey(smtpKey);

    if (null==srv){
      m2sTrace("m2sIsEmetteurMelanie2 utilisation du serveur par defaut");
      srv=MailServices.smtp.defaultServer;
    }

    if (null==srv){
      m2sTrace("m2sIsEmetteurMelanie2 le serveur smtp du compte n'a pu etre obtenu!");
      return false;
    }

    if (MSG_MELANIE2==PacomeAuthUtils.TestServeurMelanie2(srv.hostname)){
      m2sTrace("m2sIsEmetteurMelanie2 emetteur dans melanie2");
      return true;
    }
    
    m2sTrace("m2sIsEmetteurMelanie2 le serveur n'est pas dans melanie2:"+srv.hostname);
    return false;

  } catch(ex){
    m2sTrace("m2sIsEmetteurMelanie2 exception:"+ex);
  }
  
  m2sTrace("m2sIsEmetteurMelanie2 emetteur pas dans melanie2");
  return false;
}

/*
 * Test si le message en cours de composition peut etre envoye par Thunderbird (comportement standard)
 * se base sur la taille retournee par m2sTailleComposition
 * et sur la valeur de la preference "melanissimo.compose.taille"
 * 26/02/14 : ajout test domaine melanie2 => si false => traitement TB
 *
 * arguments de gMsgCompose.SendMsg
 * @param msgcompose instance nsIMsgCompose
 * @param msgtype aleur nsIMsgCompDeliverMode
 * @param identite instance nsIMsgIdentity – expéditeur du message
 * @param accountKey identifiant du compte de l'expéditeur
 * @return true si envoi par Thunderbird, false sinon
 */
function m2sCanSendByTB(msgcompose, msgtype, identite, accountKey) {

  let taille=m2sTailleComposition(msgcompose);
  m2sTrace("m2sCanSendByTB taille calculee du message:"+taille);

  let seuil=Services.prefs.getIntPref("melanissimo.compose.taille");
  m2sTrace("m2sCanSendByTB taille composee limite d'envoi:"+seuil);

  if (taille>seuil) {

    //tester/verifier domaine melanie2
    let test=Services.prefs.getBoolPref("melanissimo.emetteur.test");

    if (test && !m2sIsEmetteurMelanie2(identite)){
      m2sTrace("m2sCanSendByTB l'emetteur n'est pas dans melanie2 => envoi TB");
      m2sEcritLog(M2S_LOGS_MODULE, "L'emetteur n'est pas dans melanie2 => envoi TB");
      return true;
    }
    m2sEcritLog(M2S_LOGS_MODULE, "Envoi du message par Melanissimo", "Taille "+taille);
    
    return false;
  }
  
  return true;
}


/*
interface nsIMsgCompDeliverMode {
    const long Now = 0;
    const long Later = 1;
    const long Save = 2;
    const long SaveAs = 3;
    const long SaveAsDraft = 4;
    const long SaveAsTemplate = 5;
    const long SendUnsent = 6;
    const long AutoSaveAsDraft = 7;
    const long Background = 8;
};*/
//const nsIMsgCompDeliverMode=Components.interfaces.nsIMsgCompDeliverMode;

/*
 * Traitement d'un message avec melanissimo depuis la fenetre de composition
 *
 * arguments de gMsgCompose.SendMsg
 * @param msgcompose instance nsIMsgCompose
 * @param msgtype aleur nsIMsgCompDeliverMode
 * @param identite instance nsIMsgIdentity – expéditeur du message
 * @param accountKey identifiant du compte de l'expéditeur
 * @param msgwindow instance nsIMsgWindow
 * @param progress instance nsIMsgProgress. Écouteur progressListener (instance nsIWebProgressListener)
 *
 */
function m2sEnvoiMelanissimo(msgcompose, msgtype, identite, accountKey, msgwindow, progress) {

  m2sTrace("m2sEnvoiMelanissimo");

  let _this=this;

  function notifMsgCompose(){

    if (_this.progressListener && _this.stateListener){
      m2sTrace("m2sEnvoiMelanissimo notifMsgCompose");
      progressListener.onStateChange(null, null, Components.interfaces.nsIWebProgressListener.STATE_STOP, null);
      stateListener.ComposeProcessDone(Components.results.NS_ERROR_ABORT);
    }
  }

  //tester le support du type d'envoi
  //version 0.0.1 - type Now uniquement
  if (nsIMsgCompDeliverMode.Now==msgtype) {

    m2sTrace("m2sEnvoiMelanissimo type d'envoi gere");

    let params={_msgcompose:msgcompose, _msgtype:msgtype, _identite:identite, _accountKey:accountKey, _msgwindow:msgwindow, _progress:progress};

    m2sDisplayUI(params);

    //fermeture de la fenetre de composition si succes
    if (null!=params._retour) {
      
      m2sTrace("m2sEnvoiMelanissimo retour:"+params._retour);
      
      if (0==params._retour && msgcompose.CloseWindow) {
        m2sTrace("m2sEnvoiMelanissimo fermeture de la fenetre de composition");
        m2sEcritLog(M2S_LOGS_MODULE, "Envoi termine");
        msgcompose.CloseWindow(true);
        return;
      }
      
      m2sEcritLog(M2S_LOGS_MODULE, "Envoi annule ou erreur");
      
    } else {
      m2sTrace("m2sEnvoiMelanissimo retour null==params._retour!");
    }

  } else {

    //type non supporte
    let libtype="";
    try{
      libtype=gM2sBundle.GetStringFromName("m2sTypenongere"+"-"+msgtype);
    } catch(ex){
      libtype=gM2sBundle.formatStringFromName("m2sTypenongere-n", [msgtype], 1);
    }
    m2sTrace("m2sEnvoiMelanissimo type non supporte:"+libtype);
    m2sEcritLog(M2S_LOGS_MODULE, "Type d'envoi non supporte", libtype);

    if (nsIMsgCompDeliverMode.AutoSaveAsDraft!=msgtype)
      m2sNotifTypeMsgNonGere(msgtype);
  }

  //notification de MsgComposeCommands.js pour restaurer etat avant envoi
  notifMsgCompose();
}
