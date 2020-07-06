/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * preferences du module
 *
 * Cete-Lyon 2014
 *
 * Auteur : P.MARTINAK (Apitech SA)
 */

//si true : le module est actif
pref("melanissimo.module", true);

//url du service
pref("melanissimo.service.url", "https://melanissimo.s2.m2.e2.rie.gouv.fr/service");

//si true : logs console
pref("melanissimo.trace", false);

//si true : logs dans le fichier m2ssimo.log
pref("melanissimo.logs", false);

//si true enregistre le détails des requêtes dans le fichier m2ssimo.logs
pref("melanissimo.logs.debug", false);


//taille en octets du message compose (fenetre de composition)
//sert de taille maximale pour determiner si l'envoi peut etre fait en smtp
//la taille est calculee sur le base du corps et des pieces jointes
pref("melanissimo.compose.taille", 7489828);


//si false, ne teste pas l'émetteur pour l'envoi melanissimo
pref("melanissimo.emetteur.test", true);
