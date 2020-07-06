/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * m2MessageValidateur : objet pourla validation des messages
 */



/*
 *  objet erreur de validation
 *  libElement element du message selon les specifications du service
 *  libErreur le libelle de l'erreur de validation
 */
function m2sMsgErreurValid(libElement, libErreur){

  this.element=libElement;

  this.erreur=libErreur;
}

m2sMsgErreurValid.prototype={

  element:null,

  erreur:null,

  logErreur:function(source){
    m2sEcritLog(source, " - Erreur de validation", "Elément:"+this.element+" - Erreur:"+this.erreur);
  }
}



/*
 * objet pour la validation des messages avec les specifications du service (champ "Informatif")
 * @param jsonSpecs chaine JSON des specifications
 */
function m2MessageValidateur(jsonSpecs){

  this.specifications=jsonSpecs;
}

m2MessageValidateur.prototype={

  /*
   * Validation d'un message du type m2sMessage avec les spécifications jsonSpecs
   * return tableau des erreurs, vide si ok (object)
   */
  ValideMessage: function(message_m2s){

    if (null==this.specifications)
      throw new m2sExeception("Les spécifications Mélanissimo ne sont pas définies",-1, "validateur.js", "ValideMessage");

    this.initErreursValidation();

    //valider le sujet
    m2sTrace("m2MessageValidateur ValideMessage - valider le sujet du message");
    this.valideSujet(message_m2s);

    //valider l'emetteur
    m2sTrace("m2MessageValidateur ValideMessage - valider l'emetteur du message");
    this.valideEmetteur(message_m2s);

    //valider les destinataires To
    m2sTrace("m2MessageValidateur ValideMessage - valider les destinataires To");
    this.valideDestinataires(message_m2s.listeDestinatairesTo);

    //valider les destinataires Cc
    m2sTrace("m2MessageValidateur ValideMessage - valider les destinataires Cc");
    this.valideDestinataires(message_m2s.listeDestinatairesCc);

    //valider les destinataires Cci
    m2sTrace("m2MessageValidateur ValideMessage - valider les destinataires Cci");
    this.valideDestinataires(message_m2s.listeDestinatairesCci);

    //au moins un destinataire
    if (0==message_m2s.listeDestinatairesTo.length &&
        0==message_m2s.listeDestinatairesCc.length &&
        0==message_m2s.listeDestinatairesCci.length){
      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-destinataire"),
                                        m2sMessageFromName("m2sErreurValid-dest0"));
      erreur.logErreur("m2MessageValidateur valideDestinataires");
      this.addErreurValidation(erreur);
    }

    //valider le corps
    m2sTrace("m2MessageValidateur ValideMessage - valider le corps du message");
    this.valideCorps(message_m2s);

    //valider les pieces jointes
    m2sTrace("m2MessageValidateur ValideMessage - valider les pieces jointes");
    this.valideFichiers(message_m2s);

    if (0==this.erreursValidation.length)
      m2sTrace("m2MessageValidateur ValideMessage validation OK");
    else
      m2sTrace("m2MessageValidateur ValideMessage echec de validation");

    m2sTrace("m2MessageValidateur ValideMessage fin");

    return this.erreursValidation;
  },

  valideSujet:function(message_m2s){

    if (0==message_m2s.sujet.length){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-sujet"),
                                      m2sMessageFromName("m2sErreurValid-sujet0"));
      erreur.logErreur("m2MessageValidateur valideSujet");
      
      this.addErreurValidation(erreur);
      return;
    }

    if (message_m2s.sujet.length > this.specifications.tailleMaxSujet){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-sujet"),
                                      m2sMessageFromName("m2sErreurValid-longeur"));
                                      
      erreur.logErreur("m2MessageValidateur valideSujet");
      this.addErreurValidation(erreur);
    }
  },

  valideEmetteur:function(message_m2s){

    //validations
    if (null==message_m2s.expéditeur ||
        null==message_m2s.expéditeur.adresse ||
        ""==message_m2s.expéditeur.adresse){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-emetteur"),
                                      m2sMessageFromName("m2sErreurValid-nonvalide"));
      erreur.logErreur("m2MessageValidateur valideEmetteur");
      
      this.addErreurValidation(erreur);
      return;
    }

    if (message_m2s.expéditeur.adresse &&
        message_m2s.expéditeur.adresse.length > this.specifications.tailleMaxAdresseCourriel){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-emetteur"),
                                      m2sMessageFromName("m2sErreurValid-longeur"));
      erreur.logErreur("m2MessageValidateur valideEmetteur");
      
      this.addErreurValidation(erreur);
    }

    if (message_m2s.expéditeur.libellé &&
        message_m2s.expéditeur.libellé.length > this.specifications.tailleMaxLibelléCourriel){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-emetteur"),
                                      m2sMessageFromName("m2sErreurValid-longeur"));
      erreur.logErreur("m2MessageValidateur valideEmetteur");
      
      this.addErreurValidation(erreur);
    }
  },

  valideDestinataires:function(destinataires){

    if (null==destinataires || 0==destinataires.length)
      return;

    let nb=destinataires.length;
    for (var i=0;i<nb;i++){

      let dest=destinataires[i];

      //validations
      if (dest.libellé.length > this.specifications.tailleMaxLibelléCourriel){
        let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-destinataire"),
                                        m2sMessageFromName("m2sErreurValid-longeur"));
        erreur.logErreur("m2MessageValidateur valideDestinataires");
        
        this.addErreurValidation(erreur);
      }
      
      if (dest.adresse.length > this.specifications.tailleMaxAdresseCourriel){
        let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-destinataire"),
                                        m2sMessageFromName("m2sErreurValid-longeur"));
        erreur.logErreur("m2MessageValidateur valideDestinataires");
        
        this.addErreurValidation(erreur);
      }
    }
  },

  valideCorps:function(message_m2s){

    if (0==message_m2s.corpsMessage.length){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-corps"),
                                      m2sMessageFromName("m2sErreurValid-corps0"));
      erreur.logErreur("m2MessageValidateur valideCorps");
      
      this.addErreurValidation(erreur);
      return;
    }

    if (message_m2s.corpsMessage.length > this.specifications.tailleMaxCorpsMessage){

      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-corps"),
                                      m2sMessageFromName("m2sErreurValid-longeur"));
      erreur.logErreur("m2MessageValidateur valideCorps");
      
      this.addErreurValidation(erreur);
    }
  },

  valideFichiers:function(message_m2s){

    let fichiers=message_m2s.listeFichiers;
    if (null==fichiers){
      m2sTrace("m2MessageValidateur valideFichiers aucun fichier");
      return;
    }

    let totalTaille=0;

    let nb=fichiers.length;
    m2sTrace("m2MessageValidateur valideFichiers nombre de fichiers:"+nb);
    for (var i=0;i<nb;i++){

      let fic=fichiers[i];

      m2sTrace("m2MessageValidateur valideFichiers fichier:"+fic.nom);

      if (fic.nom.length > this.specifications.tailleMaxNomFichier){
        let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-fichier"),
                                        m2sMessageFromName("m2sErreurValid-taille"));
        erreur.logErreur("m2MessageValidateur valideFichiers");
        this.addErreurValidation(erreur);
      }
      
      let ext=this.extraitFileExt(fic.nom);
      m2sTrace("m2MessageValidateur valideFichiers extension:"+ext);
      
      if (ext && ""!=ext &&
          -1!=this.specifications.listeExtensionsFichierInterdites.indexOf(ext.toLowerCase())){
        let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-fichier"),
                                          m2sMessageFormatFromName("m2sErreurValid-extensionF2", [ext, fic.nom], 2));
        erreur.logErreur("m2MessageValidateur valideFichiers");
        
        this.addErreurValidation(erreur);
      }
      m2sTrace("m2MessageValidateur valideFichiers taille:"+fic.taille);
      totalTaille+=fic.taille;

      //tester doublon
      for (var a=0;a<i;a++){
        let fa=fichiers[a];
        if (fa.taille==fic.taille &&
            fa.empreinte==fic.empreinte){
          let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-fichier"),
                                            m2sMessageFormatFromName("m2sErreurValid-doublon", [fa.nom, fic.nom], 2));
          erreur.logErreur("m2MessageValidateur valideFichiers");
          
          this.addErreurValidation(erreur);
        }
      }
    }

    //validation tailleMaxTotalPiècesJointes
    m2sTrace("m2MessageValidateur totalTaille:"+totalTaille);
    if (totalTaille > this.specifications.tailleMaxTotalPiècesJointes){
      let erreur=new m2sMsgErreurValid(m2sMessageFromName("m2sErreurValid-fichier"),
                                      m2sMessageFromName("m2sErreurValid-tailleTotale"));
      erreur.logErreur("m2MessageValidateur valideFichiers");
      
      this.addErreurValidation(erreur);
    }
  },


  //objet tableau des specifications message melanssimo (requete.paramètres.Informatif)
  _specs: null,

  //retourne les specifications sous forme objet
  get specifications(){
    return this._specs;
  },

  set specifications(jsonSpecs){
    this._specs=JSON.parse(jsonSpecs);
  },

  //donnees de validation
  //_erreursValidation : tableau d'objets erreurs générées lors de la validation du message
  //{element:"=> libellé de l'élément du message", erreur:"=> libellé de l'erreur"}
  _erreursValidation:null,

  get erreursValidation(){
    return this._erreursValidation;
  },

  initErreursValidation: function(){
    this._erreursValidation=null;
    this._erreursValidation=[];
  },

  addErreurValidation: function(objErreur){

    if (null==this._erreursValidation)
      this.initErreursValidation();

    this._erreursValidation.push(objErreur);
  },

  extraitFileExt: function(nom){

    if (null==nom || ""==nom)
      return nom;

    let pos=nom.lastIndexOf(".");
    if (-1==pos)
      return "";

    return nom.substring(pos+1);
  }
}
