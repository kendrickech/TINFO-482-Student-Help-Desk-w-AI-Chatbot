import java.util.*;
import java.util.Scanner;
import java.util.Arrays;
import java.util.ArrayList;

public class AppMain {
    
    public static void main(String[] args){

        LoggingIntoApp();

    }

    public static void LoggingIntoApp() {

        Scanner activeAcct = new Scanner(System.in);
        boolean activeAccount = false; 

        System.out.println("DO YOU HAVE AN ACCOUNT ALREADY? Y OR N ");
        String AccountLive = activeAcct.nextLine().toUpperCase();
        
        if(AccountLive.equals("Y")) {
            activeAccount = true; 

            if (activeAccount){

                Scanner userN = new Scanner(System.in);
                Scanner userP = new Scanner(System.in);
                System.out.println("Please enter your username");

            }
        }
        else if(AccountLive.equals("N")){
        
            Scanner firstName = new Scanner(System.in);
            Scanner lastName = new Scanner(System.in);
            Scanner stuID = new Scanner(System.in);
            Scanner uName = new Scanner(System.in);
            Scanner pWord = new Scanner(System.in);


            System.out.println( "Please enter your first name: ");
            String userFirstName = firstName.nextLine().toUpperCase();

            System.out.println("Please enter your last name: ");
            String userLastName = lastName.nextLine().toUpperCase();

            System.out.println("Please enter your Student ID #: ");
            int studentID = Integer.parseInt(stuID.nextLine());

            System.out.println("Please enter a userName:  (IT IS CASE SENSITIVE)");
            String userName = uName.nextLine();

            Boolean uPassword = false;
            System.out.println("Please enter a password:  (IT IS CASE SENSITIVE & MUST BE 8 CHARACTERS LONG)");
            String userPassword = pWord.nextLine();

            while(uPassword == false){
                if (userPassword.length() < 8){
                    System.out.println("PASSWORD INVALID PLEASE MAKE IT 8 CHARACTERS LONG");

                    System.out.println("Please enter a password:  (IT IS CASE SENSITIVE & MUST BE 8 CHARACTERS LONG)");
                    userPassword = pWord.nextLine();
                }
                else {
                    System.out.println("THANK YOU FOR CREATING YOUR ACCOUNT");
                    uPassword = true;
                }
            }
            newUser createAccount = new newUser(userFirstName, userLastName, studentID, userName, userPassword);
        }
        else {
            System.out.println("Something is wrong. ");
        }
    }
}
